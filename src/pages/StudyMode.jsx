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
  const [direction, setDirection] = useState('word')
  const [isRandom, setIsRandom] = useState(false)
  const [wordSize, setWordSize] = useState('medium')
  const [meaningSize, setMeaningSize] = useState('medium')
  const [excludeMemorized, setExcludeMemorized] = useState(false)

  // 초기 설정 및 카드 데이터 로드
  useEffect(() => {
    loadStudySession()
  }, [id])

  // 설정 변경 시 localStorage 저장 (기존 백업 호환)
  const saveSettings = (key, value) => {
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
  }

  // 대상 단어 범위 토글 및 실시간 카드 필터링 재쿼리 핸들러
  const handleToggleExcludeMemorized = async (value) => {
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
      // 1. Supabase에서 단어 세트의 5종 공통 진행 방식 설정을 API 조회
      const { data: wordSet, error: setError } = await supabase
        .from('word_sets')
        .select('study_direction, study_order, word_size, meaning_size, exclude_memorized')
        .eq('id', id)
        .single()
      
      if (setError) throw setError
      
      const dir = wordSet.study_direction || 'word'
      const ord = wordSet.study_order || 'seq'
      const wSz = wordSet.word_size || 'medium'
      const mSz = wordSet.meaning_size || 'medium'
      const exMem = wordSet.exclude_memorized || false
      
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
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, cursor: 'zoom-out', padding: '1rem' }}
          >
            <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }} src={zoomedImage} style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: '12px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />
            <button style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--glass)', color: 'white', padding: '0.8rem', borderRadius: '50%', border: 'none' }}><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 그만하기
        </Link>
        <div style={{ color: 'var(--text-secondary)', fontWeight: '600', background: 'var(--glass)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem' }}>
          {currentIndex + 1} / {displayCards.length}
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{ background: 'none', border: 'none', color: showSettings ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Settings size={20} /> <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>설정</span>
        </button>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div className="card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label">대상 단어 범위</span>
                <div className="setting-segment">
                  <button onClick={() => handleToggleExcludeMemorized(false)} style={getSegmentBtnStyle(excludeMemorized === false)}>전체</button>
                  <button onClick={() => handleToggleExcludeMemorized(true)} style={getSegmentBtnStyle(excludeMemorized === true)}>암기 제외</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label">카드 방향</span>
                <div className="setting-segment">
                  <button onClick={() => { setDirection('word'); saveSettings('direction', 'word'); }} style={getSegmentBtnStyle(direction === 'word')}>단어</button>
                  <button onClick={() => { setDirection('meaning'); saveSettings('direction', 'meaning'); }} style={getSegmentBtnStyle(direction === 'meaning')}>뜻</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label">진행 순서</span>
                <div className="setting-segment">
                  <button onClick={() => { setIsRandom(false); saveSettings('isRandom', false); }} style={getSegmentBtnStyle(!isRandom)}>순차</button>
                  <button onClick={() => { setIsRandom(true); saveSettings('isRandom', true); }} style={getSegmentBtnStyle(isRandom)}>무작위</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label">단어 크기</span>
                <div className="setting-segment">
                  <button onClick={() => { setWordSize('small'); saveSettings('wordSize', 'small'); }} style={getSegmentBtnStyle(wordSize === 'small')}>작게</button>
                  <button onClick={() => { setWordSize('medium'); saveSettings('wordSize', 'medium'); }} style={getSegmentBtnStyle(wordSize === 'medium')}>보통</button>
                  <button onClick={() => { setWordSize('large'); saveSettings('wordSize', 'large'); }} style={getSegmentBtnStyle(wordSize === 'large')}>크게</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label">뜻 크기</span>
                <div className="setting-segment">
                  <button onClick={() => { setMeaningSize('small'); saveSettings('meaningSize', 'small'); }} style={getSegmentBtnStyle(meaningSize === 'small')}>작게</button>
                  <button onClick={() => { setMeaningSize('medium'); saveSettings('meaningSize', 'medium'); }} style={getSegmentBtnStyle(meaningSize === 'medium')}>보통</button>
                  <button onClick={() => { setMeaningSize('large'); saveSettings('meaningSize', 'large'); }} style={getSegmentBtnStyle(meaningSize === 'large')}>크게</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center', justifyContent: 'center' }}>
                <span className="setting-label">학습 초기화</span>
                <button
                  type="button"
                  onClick={handleResetAllMemorized}
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1.2rem',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'rgba(153, 27, 27, 0.12)',
                    border: '1px solid var(--accent-color)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    height: '32px',
                    fontFamily: 'inherit',
                    filter: 'none',
                    transition: 'all 0.2s'
                  }}
                  title="모든 단어를 '학습 중'으로 되돌립니다"
                >
                  <RotateCcw size={14} /> 전부 학습 중으로 초기화
                </button>
              </div>
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
          <div style={{ height: '400px', perspective: '1200px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }} style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}>
              <div className="card" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', border: '2px solid var(--glass-border)', padding: '2rem' }}>
                <div className="legible-word" style={{ 
                  fontSize: direction === 'word' 
                    ? getCalculatedSize(currentCard.word.length > 20 ? '1.8rem' : '3rem', wordSize)
                    : getCalculatedSize(currentCard.meaning.length > 30 ? '1.5rem' : '2.4rem', meaningSize),
                  transition: 'font-size 0.2s' 
                }}>
                  {direction === 'word' ? currentCard.word : currentCard.meaning}
                </div>
              </div>
              <div className="card" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: '#e2e8f0', transform: 'rotateY(180deg)', border: '3px solid var(--accent-color)', padding: '2rem', boxShadow: 'inset 0 0 40px rgba(99, 102, 241, 0.1)' }}>
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

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {currentCard.image_url && (
              <>
                <button onClick={() => setShowHint(!showHint)} style={{ background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', padding: '0.5rem 1.2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                  {showHint ? <><EyeOff size={16} /> 이미지 숨기기</> : <><Eye size={16} /> 첨부 이미지 확인</>}
                </button>
                <AnimatePresence>
                  {showHint && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                      <div onClick={() => setZoomedImage(currentCard.image_url)} style={{ width: '100%', maxWidth: '400px', padding: '0.8rem', borderRadius: '16px', background: 'var(--glass)', border: '1px solid var(--glass-border)', marginTop: '0.5rem', cursor: 'zoom-in' }} className="btn-hover">
                        <img src={currentCard.image_url} alt="hint" style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '300px' }} />
                        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>클릭하여 확대</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
            {/* 암기 여부 설정 세그먼트 컨트롤 */}
            <div 
              className="setting-segment" 
              style={{ 
                maxWidth: '280px', 
                width: '100%', 
                display: 'flex', 
                background: 'rgba(0, 0, 0, 0.3)', 
                padding: '3px', 
                borderRadius: '10px', 
                border: '1px solid var(--glass-border)',
                userSelect: 'none'
              }} 
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
            <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
              <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handlePrev(); }} style={{ padding: '0.8rem 2.5rem', cursor: 'pointer' }}><ChevronLeft size={24} /></button>
              <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handleNext(); }} style={{ padding: '0.8rem 2.5rem', cursor: 'pointer' }}><ChevronRight size={24} /></button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .setting-label { font-size: 0.7rem; color: var(--text-secondary); fontWeight: 700; textTransform: uppercase; letter-spacing: 0.05em; }
        .setting-segment { display: flex; background: rgba(0,0,0,0.3); padding: 3px; borderRadius: 10px; border: 1px solid var(--glass-border); }
      `}</style>
    </div>
  )
}
