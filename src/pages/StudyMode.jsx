import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Shuffle, X, Type } from 'lucide-react'

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

  // 초기 설정 불러오기
  useEffect(() => {
    const savedAll = localStorage.getItem('quick_study_settings')
    const allSettings = savedAll ? JSON.parse(savedAll) : {}
    const mySettings = allSettings[id] || {}

    // URL 파라미터가 있으면 우선 적용, 없으면 저장된 값 사용
    setDirection(queryParams.get('dir') || mySettings.direction || 'word')
    setIsRandom(queryParams.get('ord') === 'rand' || mySettings.order === 'rand' || false)
    setWordSize(mySettings.wordSize || 'medium')
    setMeaningSize(mySettings.meaningSize || 'medium')
    
    fetchCards()
  }, [id])

  // 설정 변경 시 localStorage 저장
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

  useEffect(() => {
    if (originalCards.length === 0) return

    let currentList = [...originalCards]
    if (isRandom) {
      currentList = currentList.sort(() => Math.random() - 0.5)
    }

    setDisplayCards(currentList)
    setCurrentIndex(0)
    setIsFlipped(false)
  }, [isRandom, originalCards])

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setOriginalCards(data || [])
      setDisplayCards(data || [])
    } catch (error) {
      console.error(error.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

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
            <button onClick={(e) => { e.stopPropagation(); toggleMemorized(currentCard.id, currentCard.is_memorized); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: currentCard.is_memorized ? 'var(--success)' : 'var(--glass)', color: 'white', border: currentCard.is_memorized ? 'none' : '1px solid var(--glass-border)', padding: '0.7rem 2.5rem', borderRadius: '50px', fontWeight: '600', cursor: 'pointer' }}>
              <CheckCircle2 size={20} /> {currentCard.is_memorized ? '암기 완료!' : '아직 외우는 중'}
            </button>
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
