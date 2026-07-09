import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle, XCircle, Award, RefreshCcw, Eye, EyeOff, X, Settings, ChevronLeft, ChevronRight } from 'lucide-react'

export default function TestMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testFinished, setTestFinished] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [zoomedImage, setZoomedImage] = useState(null)
  
  const [showSettings, setShowSettings] = useState(false)
  const [activeKey, setActiveKey] = useState(null)
  
  // 설정 및 권한 상태
  const [isOwner, setIsOwner] = useState(true)
  const [wordSize, setWordSize] = useState('medium')
  const [meaningSize, setMeaningSize] = useState('medium')
  const [direction, setDirection] = useState('word')
  const [isRandom, setIsRandom] = useState(false)

  // 초기 설정 및 테스트 카드 로드
  useEffect(() => {
    loadTestSession()
  }, [id])

  // 진행 순서 변경 시 카드 정렬 및 상태 리셋
  useEffect(() => {
    if (cards.length === 0) return
    let finalCards = [...cards]
    if (isRandom) {
      finalCards = finalCards.sort(() => Math.random() - 0.5)
    } else {
      finalCards = finalCards.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    }
    setCards(finalCards)
    setCurrentIndex(0)
    setIsFlipped(false)
  }, [isRandom])

  // 설정 저장 (소유주인 경우에만 Supabase API 실시간 적재, 타인은 로컬만 적용)
  const saveSettings = async (key, value) => {
    const savedAll = localStorage.getItem('quick_test_settings')
    const allSettings = savedAll ? JSON.parse(savedAll) : {}
    const currentSettings = allSettings[id] || {}
    allSettings[id] = { ...currentSettings, [key]: value }
    localStorage.setItem('quick_test_settings', JSON.stringify(allSettings))

    if (isOwner) {
      const dbFieldMap = {
        wordSize: 'word_size',
        meaningSize: 'meaning_size',
        direction: 'study_direction',
        isRandom: 'study_order'
      }
      const dbField = dbFieldMap[key]
      if (!dbField) return

      const dbValue = key === 'isRandom' ? (value ? 'rand' : 'seq') : value;

      try {
        await supabase
          .from('word_sets')
          .update({ [dbField]: dbValue })
          .eq('id', id)
      } catch (e) {
        console.error('설정 저장 실패:', e.message)
      }
    }
  }

  const loadTestSession = async () => {
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

      // 소유주 판별
      const owner = user && wordSet && wordSet.user_id === user.id
      setIsOwner(!!owner)
      
      let dir = wordSet.study_direction || 'word'
      let ord = wordSet.study_order || 'seq'
      let wSz = wordSet.word_size || 'medium'
      let mSz = wordSet.meaning_size || 'medium'

      // 만약 타인 세트라면 localStorage의 백업 설정을 오버라이드하여 유지 보장
      if (!owner) {
        const savedAll = localStorage.getItem('quick_test_settings')
        const allSettings = savedAll ? JSON.parse(savedAll) : {}
        const localSettings = allSettings[id] || {}

        if (localSettings.direction) dir = localSettings.direction
        if (localSettings.isRandom !== undefined) {
          ord = localSettings.isRandom ? 'rand' : 'seq'
        }
        if (localSettings.wordSize) wSz = localSettings.wordSize
        if (localSettings.meaningSize) mSz = localSettings.meaningSize
      }

      // 다른 사람 세트인 경우에는 암기 제외를 무조건 false로 고정
      const exMem = owner ? (wordSet.exclude_memorized || false) : false
      
      // 상태 설정
      setDirection(dir)
      setWordSize(wSz)
      setMeaningSize(mSz)
      setIsRandom(ord === 'rand')
      
      // 2. 설정된 exclude_memorized 여부에 따라 카드 데이터를 Supabase에서 분기 쿼리
      let query = supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
      
      if (exMem) {
        query = query.eq('is_memorized', false)
      }
      
      const { data: cardsData, error: cardsError } = await query
      if (cardsError) throw cardsError
      
      // 설정된 정렬 방식 적용
      let finalCards = cardsData || []
      if (ord === 'rand') {
        finalCards = [...finalCards].sort(() => Math.random() - 0.5)
      } else {
        finalCards = [...finalCards].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      }
      
      setCards(finalCards)
    } catch (error) {
      console.error(error.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleResult = async (isCorrect) => {
    if (isCorrect) {
      setCorrectCount(prev => prev + 1)
      if (isOwner) {
        await supabase
          .from('cards')
          .update({ is_memorized: true })
          .eq('id', cards[currentIndex].id)
      }
    }

    if (currentIndex + 1 < cards.length) {
      setIsFlipped(false)
      setShowHint(false)
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
      }, 150)
    } else {
      const finalScore = correctCount + (isCorrect ? 1 : 0)
      
      // 1. Supabase Cloud DB에 테스트 이력 실시간 저장 (소유주인 경우에만)
      if (isOwner) {
        supabase
          .from('word_sets')
          .update({
            last_test_date: new Date().toISOString(),
            last_test_score: finalScore,
            last_test_total: cards.length
          })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('테스트 이력 Supabase 저장 실패:', error.message)
          })
      }

      // 2. 예비용 로컬 스토리지 적재
      localStorage.setItem(`last_test_${id}`, JSON.stringify({
        date: new Date().toISOString(),
        score: finalScore,
        total: cards.length
      }))
      setTestFinished(true)
    }
  }

  const handleRestart = () => {
    setTestFinished(false)
    setCorrectCount(0)
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowHint(false)
    loadTestSession()
  }

  // 키보드 단축키 바인딩
  useEffect(() => {
    if (cards.length === 0 || testFinished) return

    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return

      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault()
        setIsFlipped((prev) => !prev)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        if (isFlipped && !activeKey) {
          setActiveKey('dontknow')
          setTimeout(() => {
            handleResult(false)
            setActiveKey(null)
          }, 200)
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        if (isFlipped && !activeKey) {
          setActiveKey('know')
          setTimeout(() => {
            handleResult(true)
            setActiveKey(null)
          }, 200)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cards, currentIndex, isFlipped, testFinished, correctCount, activeKey])

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
  
  if (cards.length === 0 && !testFinished) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <Award size={80} color="var(--success)" style={{ marginBottom: '1.5rem' }} />
      <h2>모든 단어를 마스터했습니다!</h2>
      <Link to={`/set/${id}/manage`} className="btn-primary" style={{ textDecoration: 'none', padding: '1rem 2rem' }}>관리로 가기</Link>
    </div>
  )

  if (testFinished) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <div className="card test-finished-card">
        <Award size={64} color="var(--accent-color)" style={{ marginBottom: '1.5rem' }} />
        <h1 className="text-gradient">Test Over!</h1>
        <p style={{ fontSize: '1.8rem', margin: '2rem 0' }}>{correctCount} / {cards.length} 정답</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={handleRestart}><RefreshCcw size={18} /> 다시 도전</button>
          <Link to="/" className="card" style={{ textDecoration: 'none', color: 'white' }}>세트 목록</Link>
        </div>
      </div>
    </div>
  )

  const currentCard = cards[currentIndex]

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="zoom-modal-overlay"
          >
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={zoomedImage} className="zoom-modal-img" />
            <button className="zoom-modal-close"><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="study-header">
        <Link to={`/set/${id}/study`} className="study-back-btn">
          <ArrowLeft size={18} /> 테스트 중단
        </Link>
        <div className="study-progress-badge">
          {currentIndex + 1} / {cards.length}
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
              <div className="setting-column">
                <span className="setting-label">카드 방향</span>
                <div className="setting-segment">
                  <button onClick={() => { setDirection('word'); saveSettings('direction', 'word'); }} style={getSegmentBtnStyle(direction === 'word')}>단어</button>
                  <button onClick={() => { setDirection('meaning'); saveSettings('direction', 'meaning'); }} style={getSegmentBtnStyle(direction === 'meaning')}>뜻</button>
                </div>
              </div>
              <div className="setting-column">
                <span className="setting-label">진행 순서</span>
                <div className="setting-segment">
                  <button onClick={() => { setIsRandom(false); saveSettings('isRandom', false); }} style={getSegmentBtnStyle(!isRandom)}>순차</button>
                  <button onClick={() => { setIsRandom(true); saveSettings('isRandom', true); }} style={getSegmentBtnStyle(isRandom)}>무작위</button>
                </div>
              </div>
              <div className="setting-column">
                <span className="setting-label">단어 크기</span>
                <div className="setting-segment">
                  <button onClick={() => { setWordSize('small'); saveSettings('wordSize', 'small'); }} style={getSegmentBtnStyle(wordSize === 'small')}>작게</button>
                  <button onClick={() => { setWordSize('medium'); saveSettings('wordSize', 'medium'); }} style={getSegmentBtnStyle(wordSize === 'medium')}>보통</button>
                  <button onClick={() => { setWordSize('large'); saveSettings('wordSize', 'large'); }} style={getSegmentBtnStyle(wordSize === 'large')}>크게</button>
                </div>
              </div>
              <div className="setting-column">
                <span className="setting-label">뜻 크기</span>
                <div className="setting-segment">
                  <button onClick={() => { setMeaningSize('small'); saveSettings('meaningSize', 'small'); }} style={getSegmentBtnStyle(meaningSize === 'small')}>작게</button>
                  <button onClick={() => { setMeaningSize('medium'); saveSettings('meaningSize', 'medium'); }} style={getSegmentBtnStyle(meaningSize === 'medium')}>보통</button>
                  <button onClick={() => { setMeaningSize('large'); saveSettings('meaningSize', 'large'); }} style={getSegmentBtnStyle(meaningSize === 'large')}>크게</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flashcard-container" onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div className="flashcard-inner" animate={{ rotateX: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}>
          {(() => {
            const frontText = direction === 'word' ? currentCard.word : currentCard.meaning
            const backText = direction === 'word' ? currentCard.meaning : currentCard.word
            
            return (
              <>
                {/* 카드 앞면 */}
                <div className="card flashcard-front">
                   <div className="legible-word" style={{ 
                     fontSize: getCalculatedSize(frontText.length > 20 ? '1.8rem' : '2.8rem', wordSize),
                     transition: 'font-size 0.2s' 
                   }}>{frontText}</div>
                </div>
                {/* 카드 뒷면 */}
                <div className="card flashcard-back">
                   <div className="legible-word" style={{ 
                     fontSize: getCalculatedSize(backText.length > 30 ? '1.5rem' : '2.2rem', meaningSize),
                     transition: 'font-size 0.2s' 
                   }}>{backText}</div>
                </div>
              </>
            )
          })()}
        </motion.div>
      </div>

      <div className="hint-control-section">
        {currentCard.image_url && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setShowHint(!showHint); }} className="hint-toggle-btn">
              {showHint ? <><EyeOff size={14} /> 힌트 가리기</> : <><Eye size={14} /> 첨부 이미지 확인</>}
            </button>
            <AnimatePresence>
              {showHint && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="hint-image-wrapper">
                  <div onClick={(e) => { e.stopPropagation(); setZoomedImage(currentCard.image_url); }} className="hint-image-container btn-hover">
                    <img src={currentCard.image_url} alt="hint" className="hint-image" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {isFlipped && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="study-actions-section" onClick={(e) => e.stopPropagation()}>
            <div className="setting-segment study-memorize-segment" style={{ maxWidth: '320px' }}>
              <button 
                type="button"
                className="test-action-dontknow"
                onClick={() => handleResult(false)}
                style={{
                  ...getSegmentBtnStyle(false),
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  background: activeKey === 'dontknow' ? 'rgba(153, 27, 27, 0.15)' : 'transparent',
                  color: activeKey === 'dontknow' ? 'var(--danger)' : 'var(--text-secondary)',
                  boxShadow: activeKey === 'dontknow' ? '0 0 10px rgba(185, 28, 28, 0.25)' : 'none',
                  transform: activeKey === 'dontknow' ? 'translateY(-1px)' : 'none',
                  fontFamily: 'inherit'
                }}
              >
                <XCircle size={16} />
                <span>몰라요</span>
              </button>
              <button 
                type="button"
                className="test-action-know"
                onClick={() => handleResult(true)}
                style={{
                  ...getSegmentBtnStyle(false),
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  background: activeKey === 'know' ? 'rgba(21, 128, 61, 0.15)' : 'transparent',
                  color: activeKey === 'know' ? 'var(--success)' : 'var(--text-secondary)',
                  boxShadow: activeKey === 'know' ? '0 0 10px rgba(21, 128, 61, 0.25)' : 'none',
                  transform: activeKey === 'know' ? 'translateY(-1px)' : 'none',
                  fontFamily: 'inherit'
                }}
              >
                <CheckCircle size={16} />
                <span>알아요!</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
