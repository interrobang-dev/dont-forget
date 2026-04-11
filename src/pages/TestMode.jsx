import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle, XCircle, Award, RefreshCcw, Eye, EyeOff } from 'lucide-react'

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

  useEffect(() => {
    fetchUnmemorizedCards()
  }, [id])

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
      setShowHint(false) // 힌트 초기화
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
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to={`/set/${id}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 테스트 중단
        </Link>
        <div style={{ background: 'var(--glass)', padding: '0.3rem 1rem', borderRadius: '20px', fontSize: '0.9rem' }}>
          {currentIndex + 1} / {cards.length}
        </div>
        <div style={{ color: 'var(--success)', fontWeight: '700' }}>맞힘: {correctCount}</div>
      </header>

      <div style={{ height: '400px', perspective: '1200px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        >
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: currentCard.word.length > 20 ? '1.8rem' : '2.8rem', fontWeight: '800', border: '2px solid var(--glass-border)'
          }}>
            {currentCard.word}
          </div>
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: currentCard.meaning.length > 30 ? '1.5rem' : '2.2rem', fontWeight: '600', color: 'var(--accent-color)',
            transform: 'rotateY(180deg)', border: '2px solid var(--accent-color)'
          }}>
            {currentCard.meaning}
          </div>
        </motion.div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {currentCard.image_url && (
          <>
            <button 
              onClick={() => setShowHint(!showHint)}
              style={{ 
                background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)',
                padding: '0.4rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem'
              }}
            >
              {showHint ? <><EyeOff size={14} /> 이미지 숨기기</> : <><Eye size={14} /> 첨부 이미지 확인</>}
            </button>
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{ width: '100%', maxWidth: '350px', background: 'var(--glass)', padding: '0.5rem', borderRadius: '16px', border: '1px solid var(--glass-border)' }}
                >
                  <img src={currentCard.image_url} alt="hint" style={{ width: '100%', borderRadius: '12px', maxHeight: '250px', objectFit: 'contain' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {isFlipped && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '2.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center' }}
          >
            <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handleResult(false); }} style={{ color: 'var(--danger)', padding: '1rem 2rem', fontWeight: '700' }}>
              <XCircle size={22} /> 몰라요
            </button>
            <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleResult(true); }} style={{ background: 'var(--success)', padding: '1rem 2rem', fontWeight: '700' }}>
              <CheckCircle size={22} /> 알아요!
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
