import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'

export default function StudyMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showHint, setShowHint] = useState(false)
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
        .order('display_order', { ascending: true })
      
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
    setShowHint(false) // 힌트 초기화
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length)
    }, 150)
  }

  const handlePrev = () => {
    setIsFlipped(false)
    setShowHint(false) // 힌트 초기화
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

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>
  if (cards.length === 0) return (
    <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>
      <h2>학습할 단어가 없습니다.</h2>
      <Link to={`/set/${id}/manage`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>단어 추가하러 가기</Link>
    </div>
  )

  const currentCard = cards[currentIndex]

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 그만하기
        </Link>
        <div style={{ color: 'var(--text-secondary)', fontWeight: '600', background: 'var(--glass)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem' }}>
          {currentIndex + 1} / {cards.length}
        </div>
        <Link to={`/set/${id}/test`} style={{ color: 'var(--accent-color)', fontWeight: '700', textDecoration: 'none', fontSize: '0.9rem' }}>
          테스트 모드 전환
        </Link>
      </header>

      <div style={{ height: '400px', perspective: '1200px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
          style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: currentCard.word.length > 20 ? '1.8rem' : '2.8rem', fontWeight: '800', 
            border: '2px solid var(--glass-border)', padding: '2rem', whiteSpace: 'pre-wrap'
          }}>
            {currentCard.word}
          </div>
          
          {/* Back */}
          <div className="card" style={{ 
            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
            fontSize: currentCard.meaning.length > 30 ? '1.5rem' : '2.2rem', fontWeight: '600', color: 'var(--accent-color)',
            transform: 'rotateY(180deg)', border: '2px solid var(--accent-color)', padding: '2rem', whiteSpace: 'pre-wrap'
          }}>
            {currentCard.meaning}
          </div>
        </motion.div>
      </div>

      {/* 이미지 힌트 제어 영역 */}
      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {currentCard.image_url && (
          <>
            <button 
              onClick={() => setShowHint(!showHint)}
              style={{ 
                background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)',
                padding: '0.5rem 1.2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {showHint ? <><EyeOff size={16} /> 이미지 숨기기</> : <><Eye size={16} /> 첨부 이미지 확인</>}
            </button>
            
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}
                >
                  <div style={{ width: '100%', maxWidth: '400px', padding: '1rem', borderRadius: '16px', background: 'var(--glass)', border: '1px solid var(--glass-border)', marginTop: '0.5rem' }}>
                    <img 
                      src={currentCard.image_url} 
                      alt="hint" 
                      style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '300px' }} 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); toggleMemorized(currentCard.id, currentCard.is_memorized); }}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: currentCard.is_memorized ? 'var(--success)' : 'var(--glass)',
            color: 'white', border: currentCard.is_memorized ? 'none' : '1px solid var(--glass-border)',
            padding: '0.7rem 2rem', borderRadius: '50px', fontWeight: '600'
          }}
        >
          <CheckCircle2 size={20} /> {currentCard.is_memorized ? '암기 완료!' : '아직 외우는 중'}
        </button>

        <div style={{ display: 'flex', gap: '1.5rem', width: '100%', justifyContent: 'center' }}>
          <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handlePrev(); }} style={{ padding: '0.8rem 2.5rem' }}><ChevronLeft size={24} /></button>
          <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handleNext(); }} style={{ padding: '0.8rem 2.5rem' }}><ChevronRight size={24} /></button>
        </div>
      </div>
    </div>
  )
}
