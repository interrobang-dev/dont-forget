import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'

export default function StudyMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCards()
  }, [id])

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setCards(data || [])
    } catch (error) {
      console.error(error.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    setIsFlipped(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length)
    }, 150)
  }

  const handlePrev = () => {
    setIsFlipped(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length)
    }, 150)
  }

  const toggleMemorized = async (cardId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('cards')
        .update({ is_memorized: !currentStatus })
        .eq('id', cardId)
      
      if (error) throw error
      setCards(cards.map(c => c.id === cardId ? { ...c, is_memorized: !currentStatus } : c))
    } catch (error) {
      alert(error.message)
    }
  }

  if (loading) return <div className="container">로딩 중...</div>
  if (cards.length === 0) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <h2>학습할 단어가 없습니다.</h2>
      <Link to={`/set/${id}/manage`} style={{ color: 'var(--accent-color)' }}>단어 추가하러 가기</Link>
    </div>
  )

  const currentCard = cards[currentIndex]

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 그만하기
        </Link>
        <div style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
          {currentIndex + 1} / {cards.length}
        </div>
        <Link to={`/set/${id}/test`} style={{ color: 'var(--accent-color)', fontWeight: '700', textDecoration: 'none' }}>
          테스트 모드 전환
        </Link>
      </header>

      <div style={{ height: '400px', perspective: '1000px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: '3rem', fontWeight: '800', border: '2px solid var(--glass-border)'
          }}>
            {currentCard.word}
          </div>
          
          {/* Back */}
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

      <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); toggleMemorized(currentCard.id, currentCard.is_memorized); }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: currentCard.is_memorized ? 'var(--success)' : 'var(--glass)',
            color: 'white', border: currentCard.is_memorized ? 'none' : '1px solid var(--glass-border)',
            padding: '0.8rem 2rem', borderRadius: '50px'
          }}
        >
          <CheckCircle2 size={20} /> {currentCard.is_memorized ? '외웠음!' : '아직 다 안 외웠어'}
        </button>

        <div style={{ display: 'flex', gap: '1.5rem', width: '100%', justifyContent: 'center' }}>
          <button className="card" onClick={handlePrev} style={{ padding: '1rem 2rem' }}><ChevronLeft /></button>
          <button className="card" onClick={handleNext} style={{ padding: '1rem 2rem' }}><ChevronRight /></button>
        </div>
      </div>
    </div>
  )
}
