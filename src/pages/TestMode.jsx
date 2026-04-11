import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle, XCircle, Award, RefreshCcw } from 'lucide-react'

export default function TestMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
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
        .eq('is_memorized', false) // Only unmemorized
      
      if (error) throw error
      
      // Shuffle cards
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
      // Automatically mark as memorized in DB
      await supabase
        .from('cards')
        .update({ is_memorized: true })
        .eq('id', cards[currentIndex].id)
    }

    if (currentIndex + 1 < cards.length) {
      setIsFlipped(false)
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
    fetchUnmemorizedCards()
  }

  if (loading) return <div className="container">로딩 중...</div>
  
  if (cards.length === 0 && !testFinished) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <Award size={64} color="var(--success)" style={{ marginBottom: '1.5rem' }} />
      <h2>모든 단어를 외웠습니다!</h2>
      <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2.5rem' }}>테스트할 단어가 더 이상 없어요.</p>
      <Link to={`/set/${id}/manage`} style={{ color: 'var(--accent-color)', fontWeight: '700', textDecoration: 'none' }}>새 그룹 관리하기</Link>
    </div>
  )

  if (testFinished) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <Award size={64} color="var(--accent-color)" style={{ marginBottom: '1.5rem' }} />
      <h1 className="text-gradient">테스트 완료!</h1>
      <p style={{ fontSize: '1.5rem', margin: '2rem 0' }}>{cards.length}개 중 {correctCount}개를 맞혔습니다.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn-primary" onClick={handleRestart} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCcw size={18} /> 다시 테스트
        </button>
        <Link to="/" className="card" style={{ textDecoration: 'none', color: 'white' }}>대시보드로</Link>
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
        <div style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
          {currentIndex + 1} / {cards.length}
        </div>
        <div style={{ color: 'var(--success)' }}>맞힘: {correctCount}</div>
      </header>

      <div style={{ height: '400px', perspective: '1000px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        >
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: '3rem', fontWeight: '800', border: '2px solid var(--glass-border)'
          }}>
            {currentCard.word}
          </div>
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: '2.5rem', fontWeight: '600', color: 'var(--accent-color)',
            transform: 'rotateY(180deg)', border: '2px solid var(--accent-color)'
          }}>
            {currentCard.meaning}
          </div>
        </motion.div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
        카드를 클릭해서 답을 확인하세요.
      </p>

      {isFlipped && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center' }}
        >
          <button 
            className="card" 
            onClick={() => handleResult(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', padding: '1rem 2rem' }}
          >
            <XCircle /> 아직 몰라요
          </button>
          <button 
            className="btn-primary" 
            onClick={() => handleResult(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--success)', padding: '1rem 2rem' }}
          >
            <CheckCircle /> 맞혔어요!
          </button>
        </motion.div>
      )}
    </div>
  )
}
