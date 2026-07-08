import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Shuffle, X, Type, BookOpen, RotateCcw } from 'lucide-react'

export default function StudyMode() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [originalCards, setOriginalCards] = useState([])
  const [displayCards, setDisplayCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [zoomedImage, setZoomedImage] = useState(null)
  
  // URL 쿼리 파라미터 초기값
  const queryParams = new URLSearchParams(location.search)
  
  // 세트별 설정 로드/저장 로직
  const [isOwner, setIsOwner] = useState(true)
  const [direction, setDirection] = useState('word')
  const [isRandom, setIsRandom] = useState(false)
  const [wordSize, setWordSize] = useState('medium')
  const [meaningSize, setMeaningSize] = useState('medium')
  const [excludeMemorized, setExcludeMemorized] = useState(false)

  // 초기 설정 및 카드 데이터 로드
  useEffect(() => {
    loadStudySession()
  }, [id])

  // 설정 변경 시 localStorage 저장 및 소유주인 경우에만 Supabase 저장
  const saveSettings = async (key, value) => {
    const savedAll = localStorage.getItem('quick_study_settings')
    const allSettings = savedAll ? JSON.parse(savedAll) : {}
    
    const currentMySettings = allSettings[id] || {}
    
    // 호환성을 위해 키 명칭 매핑 (대시보드와 공유)
    let finalKey = key;
    let finalValue = value;
    if (key === 'isRandom') {
      finalKey = 'order';
      finalValue = value ? 'rand' : 'seq';
    }

    allSettings[id] = { ...currentMySettings, [finalKey]: finalValue }
    localStorage.setItem('quick_study_settings', JSON.stringify(allSettings))

    // 소유주인 경우에만 클라우드 DB에 동기화
    if (isOwner) {
      const dbFieldMap = {
        direction: 'study_direction',
        isRandom: 'study_order',
        wordSize: 'word_size',
        meaningSize: 'meaning_size'
      }
      const dbField = dbFieldMap[key]
      if (dbField) {
        const val = key === 'isRandom' ? (value ? 'rand' : 'seq') : value;
        try {
          await supabase
            .from('word_sets')
            .update({ [dbField]: val })
            .eq('id', id)
        } catch (e) {
          console.error('클라우드 설정 저장 실패:', e.message)
        }
      }
    }
  }

  // 대상 단어 범위 토글 및 실시간 카드 필터링 재쿼리 핸들러
  const handleToggleExcludeMemorized = async (value) => {
    if (!isOwner) return // 타인 세트일 경우 차단
    setExcludeMemorized(value)
    
    // 1. Supabase Cloud DB 실시간 저장
    try {
      await supabase
        .from('word_sets')
        .update({ exclude_memorized: value })
        .eq('id', id)
    } catch (e) {
      console.error('설정 저장 실패:', e.message)
    }

    // 2. 카드 목록 실시간 재쿼리 및 갱신 (진행 도중이므로 인덱스 0 회귀)
    try {
      let query = supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
      
      if (value) {
        query = query.eq('is_memorized', false)
      }
      
      const { data: cardsData, error: cardsError } = await query.order('display_order', { ascending: true })
      if (cardsError) throw cardsError
      
      const original = cardsData || []
      setOriginalCards(original)
      
      let currentList = [...original]
      if (isRandom) {
        currentList = currentList.sort(() => Math.random() - 0.5)
      }
      setDisplayCards(currentList)
      setCurrentIndex(0)
      setIsFlipped(false)
    } catch (err) {
      console.error('카드 갱신 실패:', err.message)
    }
  }

  // 진행 순서(순차/무작위) 토글 설정 변경 시에만 목록 재배열 및 인덱스 초기화
  useEffect(() => {
    if (originalCards.length === 0) return

    let currentList = [...originalCards]
    if (isRandom) {
      currentList = currentList.sort(() => Math.random() - 0.5)
    }

    setDisplayCards(currentList)
    setCurrentIndex(0)
    setIsFlipped(false)
  }, [isRandom])

  const loadStudySession = async () => {
    setLoading(true)
    try {
      // 0. 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Supabase에서 단어 세트의 5종 공통 진행 방식 설정을 API 조회
      const { data: wordSet, error: setError } = await supabase
        .from('word_sets')
        .select('user_id, study_direction, study_order, word_size, meaning_size, exclude_memorized')
        .eq('id', id)
        .single()
      
      if (setError) throw setError
      
      // 소유주 여부 판단
      const owner = user && wordSet && wordSet.user_id === user.id
      setIsOwner(!!owner)

      let dir = wordSet.study_direction || 'word'
      let ord = wordSet.study_order || 'seq'
      let wSz = wordSet.word_size || 'medium'
      let mSz = wordSet.meaning_size || 'medium'
      
      // 만약 타인 세트라면 localStorage의 백업 설정을 오버라이드하여 유지 보장
      if (!owner) {
        const savedAll = localStorage.getItem('quick_study_settings')
        const allSettings = savedAll ? JSON.parse(savedAll) : {}
        const localSettings = allSettings[id] || {}
        
        if (localSettings.direction) dir = localSettings.direction
        if (localSettings.order) ord = localSettings.order
        if (localSettings.wordSize) wSz = localSettings.wordSize
        if (localSettings.meaningSize) mSz = localSettings.meaningSize
      }

      // 다른 사람 세트인 경우에는 암기 제외를 무조건 false로 고정
      const exMem = owner ? (wordSet.exclude_memorized || false) : false
      
      // 리액트 로컬 상태 설정
      setDirection(dir)
      setIsRandom(ord === 'rand')
      setWordSize(wSz)
      setMeaningSize(mSz)
      setExcludeMemorized(exMem)
      
      // 2. 설정된 exclude_memorized 여부에 따라 카드 데이터를 Supabase에서 분기 쿼리
      let query = supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
      
      if (exMem) {
        query = query.eq('is_memorized', false)
      }
      
      const { data: cardsData, error: cardsError } = await query.order('display_order', { ascending: true })
      if (cardsError) throw cardsError
      
      const original = cardsData || []
      setOriginalCards(original)
      
      // 순차 / 무작위 정렬 반영
      let currentList = [...original]
      if (ord === 'rand') {
        currentList = currentList.sort(() => Math.random() - 0.5)
      }
      setDisplayCards(currentList)
      setCurrentIndex(0)
      setIsFlipped(false)
    } catch (err) {
      console.error('학습 세션 로드 실패:', err.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  // 키보드 단축키 바인딩: 스페이스바(카드 뒤집기), 좌우 방향키(이전/다음 카드 이동)
  useEffect(() => {
    if (displayCards.length === 0) return

    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((prev) => !prev)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [displayCards])

  const handleNext = () => {
    setIsFlipped(false)
    setShowHint(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % displayCards.length)
    }, 150)
  }

  const handlePrev = () => {
    setIsFlipped(false)
    setShowHint(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + displayCards.length) % displayCards.length)
    }, 150)
  }

  const toggleMemorized = async (cardId, currentStatus) => {
    if (!isOwner) return // 타인 세트일 경우 스킵
    try {
      const { error } = await supabase
        .from('cards')
        .update({ is_memorized: !currentStatus })
        .eq('id', cardId)
      
      if (error) throw error
      const updateList = (list) => list.map(c => c.id === cardId ? { ...c, is_memorized: !currentStatus } : c)
      setOriginalCards(updateList(originalCards))
      setDisplayCards(updateList(displayCards))
    } catch (error) {
      alert(error.message)
    }
  }

  const handleResetAllMemorized = async () => {
    if (!isOwner) return // 타인 세트일 경우 스킵
    if (!confirm("이 세트의 모든 단어를 '학습 중' 상태로 초기화하시겠습니까?")) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('cards')
        .update({ is_memorized: false })
        .eq('set_id', id)
      
      if (error) throw error
      
      const resetList = (list) => list.map(c => ({ ...c, is_memorized: false }))
      setOriginalCards(resetList(originalCards))
      setDisplayCards(resetList(displayCards))
      alert("모든 단어 카드의 암기 여부가 '학습 중' 상태로 초기화되었습니다.")
    } catch (error) {
      alert("초기화 실패: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getSegmentBtnStyle = (active) => ({
    padding: '0.4rem 1rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '700',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    background: active ? 'var(--accent-color)' : 'transparent',
    color: active ? '#ffffff' : 'var(--text-secondary)',
    boxShadow: active ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
    border: 'none',
    cursor: 'pointer'
  })

  const getCalculatedSize = (baseSize, scaleType) => {
    const scale = scaleType === 'small' ? 0.75 : scaleType === 'large' ? 1.35 : 1.0;
    return `calc(${baseSize} * ${scale})`;
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>
  const currentCard = displayCards[currentIndex]

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="zoom-modal-overlay"
          >
            <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} src={zoomedImage} className="zoom-modal-img" />
            <button className="zoom-modal-close"><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="study-header">
        <Link to="/" className="study-back-btn">
          <ArrowLeft size={18} /> 그만하기
        </Link>
        <div className="study-progress-badge">
          {currentIndex + 1} / {displayCards.length}
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="study-settings-btn"
          style={{ color: showSettings ? 'var(--accent-color)' : 'var(--text-secondary)' }}
        >
          <Settings size={20} /> <span>설정</span>
        </button>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div className="card study-settings-panel">
              {isOwner && (
                <div className="settings-row">
                  <span className="settings-label">대상 단어 범위</span>
                  <div className="setting-segment" style={{ width: '100%', maxWidth: '300px' }}>
                    <button onClick={() => handleToggleExcludeMemorized(false)} style={getSegmentBtnStyle(excludeMemorized === false)}>전체</button>
                    <button onClick={() => handleToggleExcludeMemorized(true)} style={getSegmentBtnStyle(excludeMemorized === true)}>암기 제외</button>
                  </div>
                </div>
              )}
              <div className="settings-row">
                <span className="settings-label">카드 방향</span>
                <div className="setting-segment" style={{ width: '100%', maxWidth: '300px' }}>
                  <button onClick={() => { setDirection('word'); saveSettings('direction', 'word'); }} style={getSegmentBtnStyle(direction === 'word')}>단어</button>
                  <button onClick={() => { setDirection('meaning'); saveSettings('direction', 'meaning'); }} style={getSegmentBtnStyle(direction === 'meaning')}>뜻</button>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">진행 순서</span>
                <div className="setting-segment" style={{ width: '100%', maxWidth: '300px' }}>
                  <button onClick={() => { setIsRandom(false); saveSettings('isRandom', false); }} style={getSegmentBtnStyle(!isRandom)}>순차</button>
                  <button onClick={() => { setIsRandom(true); saveSettings('isRandom', true); }} style={getSegmentBtnStyle(isRandom)}>무작위</button>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">단어 크기</span>
                <div className="setting-segment" style={{ width: '100%', maxWidth: '300px' }}>
                  <button onClick={() => { setWordSize('small'); saveSettings('wordSize', 'small'); }} style={getSegmentBtnStyle(wordSize === 'small')}>작게</button>
                  <button onClick={() => { setWordSize('medium'); saveSettings('wordSize', 'medium'); }} style={getSegmentBtnStyle(wordSize === 'medium')}>보통</button>
                  <button onClick={() => { setWordSize('large'); saveSettings('wordSize', 'large'); }} style={getSegmentBtnStyle(wordSize === 'large')}>크게</button>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">뜻 크기</span>
                <div className="setting-segment" style={{ width: '100%', maxWidth: '300px' }}>
                  <button onClick={() => { setMeaningSize('small'); saveSettings('meaningSize', 'small'); }} style={getSegmentBtnStyle(meaningSize === 'small')}>작게</button>
                  <button onClick={() => { setMeaningSize('medium'); saveSettings('meaningSize', 'medium'); }} style={getSegmentBtnStyle(meaningSize === 'medium')}>보통</button>
                  <button onClick={() => { setMeaningSize('large'); saveSettings('meaningSize', 'large'); }} style={getSegmentBtnStyle(meaningSize === 'large')}>크게</button>
                </div>
              </div>
              {isOwner && (
                <div className="settings-row" style={{ marginTop: '0.4rem', height: 'auto' }}>
                  <span className="settings-label">학습 초기화</span>
                  <button
                    type="button"
                    onClick={handleResetAllMemorized}
                    className="btn-primary"
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'rgba(153, 27, 27, 0.12)',
                      border: '1px solid var(--accent-color)',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      height: '28px',
                      fontFamily: 'inherit',
                      width: '100%',
                      maxWidth: '300px',
                      transition: 'all 0.2s'
                    }}
                    title="모든 단어를 '학습 중'으로 되돌립니다"
                  >
                    <RotateCcw size={13} /> 전부 학습 중으로 초기화
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!currentCard ? (
         <div style={{ textAlign: 'center', padding: '5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>학습할 단어가 없습니다.</h2>
            <Link to={`/set/${id}/manage`} className="btn-primary" style={{ textDecoration: 'none', padding: '0.7rem 1.5rem' }}>단어 추가하러 가기</Link>
         </div>
      ) : (
        <>
          <div className="flashcard-container" onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div className="flashcard-inner" animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}>
              <div className="card flashcard-front">
                <div className="legible-word" style={{ 
                  fontSize: direction === 'word' 
                    ? getCalculatedSize(currentCard.word.length > 20 ? '1.8rem' : '3rem', wordSize)
                    : getCalculatedSize(currentCard.meaning.length > 30 ? '1.5rem' : '2.4rem', meaningSize),
                  transition: 'font-size 0.2s' 
                }}>
                  {direction === 'word' ? currentCard.word : currentCard.meaning}
                </div>
              </div>
              <div className="card flashcard-back">
                <div className="legible-word" style={{ 
                  fontSize: direction === 'word'
                    ? getCalculatedSize(currentCard.meaning.length > 30 ? '1.5rem' : '2.4rem', meaningSize)
                    : getCalculatedSize(currentCard.word.length > 20 ? '1.8rem' : '3rem', wordSize),
                  transition: 'font-size 0.2s' 
                }}>
                  {direction === 'word' ? currentCard.meaning : currentCard.word}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="hint-control-section">
            {currentCard.image_url && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }} className="hint-toggle-btn">
                  {showHint ? <><EyeOff size={16} /> 이미지 숨기기</> : <><Eye size={16} /> 첨부 이미지 확인</>}
                </button>
                <AnimatePresence>
                  {showHint && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="hint-image-wrapper">
                      <div onClick={(e) => { e.stopPropagation(); setZoomedImage(currentCard.image_url); }} className="hint-image-container btn-hover">
                        <img src={currentCard.image_url} alt="hint" className="hint-image" />
                        <div className="hint-text">클릭하여 확대</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          <div className="study-actions-section">
            {/* 암기 여부 설정 세그먼트 컨트롤 - 소유주인 경우에만 렌더링 */}
            {isOwner && (
              <div 
                className="setting-segment study-memorize-segment" 
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  type="button"
                  onClick={() => {
                    if (currentCard.is_memorized) {
                      toggleMemorized(currentCard.id, true)
                    }
                  }} 
                  style={{
                    ...getSegmentBtnStyle(!currentCard.is_memorized),
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1rem',
                    fontFamily: 'inherit'
                  }}
                >
                  <BookOpen size={16} />
                  <span>학습 중</span>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (!currentCard.is_memorized) {
                      toggleMemorized(currentCard.id, false)
                    }
                  }} 
                  style={{
                    ...getSegmentBtnStyle(currentCard.is_memorized),
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1rem',
                    background: currentCard.is_memorized ? 'var(--success)' : 'transparent',
                    boxShadow: currentCard.is_memorized ? '0 2px 8px rgba(21, 128, 61, 0.3)' : 'none',
                    fontFamily: 'inherit'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>암기 완료</span>
                </button>
              </div>
            )}
            <div className="study-nav-buttons">
              <button className="card study-nav-btn btn-hover" onClick={(e) => { e.stopPropagation(); handlePrev(); }}><ChevronLeft size={24} /></button>
              <button className="card study-nav-btn btn-hover" onClick={(e) => { e.stopPropagation(); handleNext(); }}><ChevronRight size={24} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
