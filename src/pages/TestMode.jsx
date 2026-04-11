import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle, XCircle, Award, RefreshCcw, Eye, EyeOff, X, Settings } from 'lucide-react'

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
  
  // 단어와 뜻 크기 개별 관리
  const [wordSize, setWordSize] = useState('medium')
  const [meaningSize, setMeaningSize] = useState('medium')

  // 설정 로드
  useEffect(() => {
    const savedAll = localStorage.getItem('quick_study_settings')
    const allSettings = savedAll ? JSON.parse(savedAll) : {}
    const mySettings = allSettings[id] || {}

    setWordSize(mySettings.wordSize || 'medium')
    setMeaningSize(mySettings.meaningSize || 'medium')
    
    fetchUnmemorizedCards()
  }, [id])

  // 설정 저장
  const saveSettings = (key, value) => {
    const savedAll = localStorage.getItem('quick_study_settings')
    const allSettings = savedAll ? JSON.parse(savedAll) : {}
    const currentMySettings = allSettings[id] || {}

    allSettings[id] = { ...currentMySettings, [key]: value }
    localStorage.setItem('quick_study_settings', JSON.stringify(allSettings))
  }

  const fetchUnmemorizedCards = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
        .eq('is_memorized', false)
      
      if (error) throw error
      const shuffled = (data || []).sort(() => Math.random() - 0.5)
      setCards(shuffled)
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
      await supabase
        .from('cards')
        .update({ is_memorized: true })
        .eq('id', cards[currentIndex].id)
    }

    if (currentIndex + 1 < cards.length) {
      setIsFlipped(false)
      setShowHint(false)
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
      }, 150)
    } else {
      setTestFinished(true)
    }
  }

  const handleRestart = () => {
    setTestFinished(false)
    setCorrectCount(0)
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowHint(false)
    fetchUnmemorizedCards()
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
  
  if (cards.length === 0 && !testFinished) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <Award size={80} color="var(--success)" style={{ marginBottom: '1.5rem' }} />
      <h2>모든 단어를 마스터했습니다!</h2>
      <Link to={`/set/${id}/manage`} className="btn-primary" style={{ textDecoration: 'none', padding: '1rem 2rem' }}>관리로 가기</Link>
    </div>
  )

  if (testFinished) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <div className="card" style={{ background: 'var(--glass)', padding: '3rem', borderRadius: '32px' }}>
        <Award size={64} color="var(--accent-color)" style={{ marginBottom: '1.5rem' }} />
        <h1 className="text-gradient">Test Over!</h1>
        <p style={{ fontSize: '1.8rem', margin: '2rem 0' }}>{correctCount} / {cards.length} 정답</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={handleRestart}><RefreshCcw size={18} /> 다시 도전</button>
          <Link to="/" className="card" style={{ textDecoration: 'none', color: 'white' }}>대시보드</Link>
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
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, cursor: 'zoom-out', padding: '1.5rem' }}
          >
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={zoomedImage} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px' }} />
            <button style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '50%', cursor: 'pointer' }}><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to={`/set/${id}/study`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 테스트 중단
        </Link>
        <div style={{ background: 'var(--glass)', padding: '0.3rem 1rem', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
          {currentIndex + 1} / {cards.length}
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
            <div className="card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label-mini">단어 크기</span>
                <div className="setting-segment-mini">
                  <button onClick={() => { setWordSize('small'); saveSettings('wordSize', 'small'); }} style={getSegmentBtnStyle(wordSize === 'small')}>작게</button>
                  <button onClick={() => { setWordSize('medium'); saveSettings('wordSize', 'medium'); }} style={getSegmentBtnStyle(wordSize === 'medium')}>보통</button>
                  <button onClick={() => { setWordSize('large'); saveSettings('wordSize', 'large'); }} style={getSegmentBtnStyle(wordSize === 'large')}>크게</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span className="setting-label-mini">뜻 크기</span>
                <div className="setting-segment-mini">
                  <button onClick={() => { setMeaningSize('small'); saveSettings('meaningSize', 'small'); }} style={getSegmentBtnStyle(meaningSize === 'small')}>작게</button>
                  <button onClick={() => { setMeaningSize('medium'); saveSettings('meaningSize', 'medium'); }} style={getSegmentBtnStyle(meaningSize === 'medium')}>보통</button>
                  <button onClick={() => { setMeaningSize('large'); saveSettings('meaningSize', 'large'); }} style={getSegmentBtnStyle(meaningSize === 'large')}>크게</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ height: '400px', perspective: '1200px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }} style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}>
          <div className="card" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', border: '2px solid var(--glass-border)', padding: '2rem' }}>
             <div className="legible-word" style={{ 
               fontSize: getCalculatedSize(currentCard.word.length > 20 ? '1.8rem' : '2.8rem', wordSize),
               transition: 'font-size 0.2s' 
             }}>{currentCard.word}</div>
          </div>
          <div className="card" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: '#e2e8f0', transform: 'rotateY(180deg)', border: '3px solid var(--accent-color)', padding: '2rem', boxShadow: 'inset 0 0 40px rgba(99, 102, 241, 0.1)' }}>
             <div className="legible-word" style={{ 
               fontSize: getCalculatedSize(currentCard.meaning.length > 30 ? '1.5rem' : '2.2rem', meaningSize),
               transition: 'font-size 0.2s' 
             }}>{currentCard.meaning}</div>
          </div>
        </motion.div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {currentCard.image_url && (
          <>
            <button onClick={() => setShowHint(!showHint)} style={{ background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', padding: '0.4rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              {showHint ? <><EyeOff size={14} /> 힌트 가리기</> : <><Eye size={14} /> 첨부 이미지 확인</>}
            </button>
            <AnimatePresence>
              {showHint && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: '350px', background: 'var(--glass)', padding: '0.6rem', borderRadius: '16px', border: '1px solid var(--glass-border)', cursor: 'zoom-in' }} onClick={() => setZoomedImage(currentCard.image_url)}>
                  <img src={currentCard.image_url} alt="hint" style={{ width: '100%', borderRadius: '12px', maxHeight: '250px', objectFit: 'contain' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {isFlipped && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '2.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
            <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handleResult(false); }} style={{ color: 'var(--danger)', padding: '1rem 2rem', fontWeight: '700', cursor: 'pointer' }}>
              <XCircle size={22} /> 몰라요
            </button>
            <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleResult(true); }} style={{ background: 'var(--success)', padding: '1rem 2rem', fontWeight: '700', cursor: 'pointer' }}>
              <CheckCircle size={22} /> 알아요!
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .setting-label-mini { font-size: 0.7rem; color: var(--text-secondary); fontWeight: 700; textTransform: uppercase; }
        .setting-segment-mini { display: flex; background: rgba(0,0,0,0.3); padding: 3px; borderRadius: 10px; border: 1px solid var(--glass-border); }
      `}</style>
    </div>
  )
}
