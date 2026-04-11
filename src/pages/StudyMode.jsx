import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, Settings, Shuffle, ArrowRightLeft } from 'lucide-react'

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
  
  // URL 파라미터에서 초기 설정 읽기
  const queryParams = new URLSearchParams(location.search)
  const initialDir = queryParams.get('dir') || 'word'
  const initialOrd = queryParams.get('ord') || 'seq'

  const [direction, setDirection] = useState(initialDir) 
  const [isRandom, setIsRandom] = useState(initialOrd === 'rand')

  useEffect(() => {
    fetchCards()
  }, [id])

  // 설정이나 원본 데이터 변경 시 카드 리스트 재구성
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
    padding: '0.4rem 1.2rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '700',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    background: active ? 'var(--accent-color)' : 'transparent',
    color: active ? '#ffffff' : 'var(--text-secondary)',
    boxShadow: active ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none'
  })

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>
  const currentCard = displayCards[currentIndex]

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 그만하기
        </Link>
        <div style={{ color: 'var(--text-secondary)', fontWeight: '600', background: 'var(--glass)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem' }}>
          {currentIndex + 1} / {displayCards.length}
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{ background: 'none', color: showSettings ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Settings size={20} /> <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>설정</span>
        </button>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div className="card" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>카드 방향</span>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <button onClick={() => setDirection('word')} style={getSegmentBtnStyle(direction === 'word')}>단어 우선</button>
                  <button onClick={() => setDirection('meaning')} style={getSegmentBtnStyle(direction === 'meaning')}>뜻 우선</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>진행 순서</span>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <button onClick={() => setIsRandom(false)} style={getSegmentBtnStyle(!isRandom)}>순차적</button>
                  <button onClick={() => setIsRandom(true)} style={getSegmentBtnStyle(isRandom)}>무작위</button>
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
              <div className="card" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', fontSize: (direction === 'word' ? currentCard.word : currentCard.meaning).length > 20 ? '1.8rem' : '2.8rem', fontWeight: '800', border: '2px solid var(--glass-border)', padding: '2rem', whiteSpace: 'pre-wrap' }}>
                <div className="legible-word">{direction === 'word' ? currentCard.word : currentCard.meaning}</div>
              </div>
              <div className="card" style={{ position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', fontSize: (direction === 'word' ? currentCard.meaning : currentCard.word).length > 30 ? '1.5rem' : '2.2rem', fontWeight: '700', color: '#e2e8f0', transform: 'rotateY(180deg)', border: '3px solid var(--accent-color)', padding: '2rem', whiteSpace: 'pre-wrap', boxShadow: 'inset 0 0 40px rgba(99, 102, 241, 0.1)' }}>
                <div className="legible-word">{direction === 'word' ? currentCard.meaning : currentCard.word}</div>
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
                      <div style={{ width: '100%', maxWidth: '400px', padding: '1rem', borderRadius: '16px', background: 'var(--glass)', border: '1px solid var(--glass-border)', marginTop: '0.5rem' }}>
                        <img src={currentCard.image_url} alt="hint" style={{ width: '100%', borderRadius: '8px', objectFit: 'contain', maxHeight: '300px' }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
            <button onClick={(e) => { e.stopPropagation(); toggleMemorized(currentCard.id, currentCard.is_memorized); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: currentCard.is_memorized ? 'var(--success)' : 'var(--glass)', color: 'white', border: currentCard.is_memorized ? 'none' : '1px solid var(--glass-border)', padding: '0.7rem 2.5rem', borderRadius: '50px', fontWeight: '600' }}>
              <CheckCircle2 size={20} /> {currentCard.is_memorized ? '암기 완료!' : '아직 외우는 중'}
            </button>
            <div style={{ display: 'flex', gap: '1.5rem', width: '100%', justifyContent: 'center' }}>
              <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handlePrev(); }} style={{ padding: '0.8rem 2.5rem' }}><ChevronLeft size={24} /></button>
              <button className="card btn-hover" onClick={(e) => { e.stopPropagation(); handleNext(); }} style={{ padding: '0.8rem 2.5rem' }}><ChevronRight size={24} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
