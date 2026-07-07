import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, Reorder, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, Plus, Trash2, Save, GripVertical, 
  Image as ImageIcon, X, Loader2, BookOpen, Clock, Edit2,
  Globe, Lock
} from 'lucide-react'

export default function SetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [set, setSet] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [zoomedImage, setZoomedImage] = useState(null)

  const [newCard, setNewCard] = useState({ word: '', meaning: '', image: null, preview: null })
  const [editingCard, setEditingCard] = useState(null)

  useEffect(() => {
    fetchSetAndCards()
  }, [id])

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from('word_sets').select('*').eq('id', id).single()
      if (setError) throw setError
      setSet(setData)

      const { data: cardsData, error: cardsError } = await supabase
        .from('cards').select('*').eq('set_id', id).order('display_order', { ascending: true })
      if (cardsError) throw cardsError
      setCards(cardsData || [])
    } catch (error) {
      console.error(error.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePublic = async () => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const newStatus = !set.is_public
      const { error } = await supabase
        .from('word_sets')
        .update({ is_public: newStatus })
        .eq('id', id)
      if (error) throw error
      setSet({ ...set, is_public: newStatus })
    } catch (error) {
      alert('공개 상태 변경에 실패했습니다: ' + error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleImageChange = (e, isEdit = false) => {
    const file = e.target.files[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      if (isEdit) {
        setEditingCard({ ...editingCard, image: file, preview: previewUrl })
      } else {
        setNewCard({ ...newCard, image: file, preview: previewUrl })
      }
    }
  }

  const uploadImage = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${fileName}`
    const { error: uploadError } = await supabase.storage.from('word-images').upload(filePath, file)
    if (uploadError) throw uploadError
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/word-images/${filePath}`
  }

  const handleAddCard = async (e) => {
    e.preventDefault()
    if (!newCard.word.trim() || !newCard.meaning.trim()) return
    setActionLoading(true)
    try {
      let image_url = null
      if (newCard.image) image_url = await uploadImage(newCard.image)
      const { data, error } = await supabase.from('cards').insert([{
        set_id: id, word: newCard.word, meaning: newCard.meaning, image_url, display_order: cards.length
      }]).select()
      if (error) throw error
      setCards([...cards, data[0]])
      setNewCard({ word: '', meaning: '', image: null, preview: null })
    } catch (error) {
      alert(error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteCard = async (cardId, imageUrl) => {
    if (!confirm('단어를 삭제하시겠습니까?')) return
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId)
      if (error) throw error
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop()
        await supabase.storage.from('word-images').remove([fileName])
      }
      setCards(cards.filter(c => c.id !== cardId))
    } catch (error) {
      alert(error.message)
    }
  }

  const handleUpdateCard = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    try {
      let image_url = editingCard.image_url
      if (editingCard.image) image_url = await uploadImage(editingCard.image)
      const { error } = await supabase.from('cards').update({
        word: editingCard.word, meaning: editingCard.meaning, image_url
      }).eq('id', editingCard.id)
      if (error) throw error
      setCards(cards.map(c => c.id === editingCard.id ? { ...editingCard, image_url } : c))
      setEditingCard(null)
    } catch (error) {
      alert(error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReorder = async (newOrder) => {
    setCards(newOrder)
    const updates = newOrder.map((card, index) => ({ id: card.id, display_order: index }))
    for (const update of updates) {
      await supabase.from('cards').update({ display_order: update.display_order }).eq('id', update.id)
    }
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>

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

      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} /> 대시보드
        </Link>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <h2 style={{ fontSize: '1.5rem' }}>{set.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>총 {cards.length}개의 단어</p>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' }}>|</span>
            <button
              onClick={handleTogglePublic}
              disabled={actionLoading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                color: set.is_public ? 'var(--accent-color)' : 'var(--text-secondary)',
                transition: 'color 0.2s',
                filter: 'none'
              }}
              title={set.is_public ? "공개 설정됨 (클릭 시 비공개 전환)" : "비공개 설정됨 (클릭 시 공개 전환)"}
            >
              {set.is_public ? <><Globe size={14} /> 전체 공개</> : <><Lock size={14} /> 비공개</>}
            </button>
          </div>
        </div>
      </header>

      {/* 단어 추가 폼 */}
      <section className="card" style={{ marginBottom: '3rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} color="var(--accent-color)" /> 새로운 단어 추가
        </h3>
        <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div className="input-row">
            <textarea
              className="legible-input"
              style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '1.2rem', minHeight: '120px', resize: 'vertical' }}
              placeholder="단어 (예: Apple)"
              value={newCard.word}
              onChange={(e) => setNewCard({ ...newCard, word: e.target.value })}
            />
            <textarea
              className="legible-input"
              style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '1.2rem', minHeight: '120px', resize: 'vertical' }}
              placeholder="뜻 (예: 사과)"
              value={newCard.meaning}
              onChange={(e) => setNewCard({ ...newCard, meaning: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
              <ImageIcon size={18} /> {newCard.image ? '이미지 교체' : '이미지 첨부'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageChange(e)} />
            </label>
            {newCard.preview && (
              <div onClick={() => setZoomedImage(newCard.preview)} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', cursor: 'zoom-in' }}>
                <img src={newCard.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={(e) => { e.stopPropagation(); setNewCard({ ...newCard, image: null, preview: null }); }} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px', border: 'none' }}><X size={12} /></button>
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={actionLoading} style={{ marginLeft: 'auto', padding: '0.8rem 2rem' }}>
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : '추가하기'}
            </button>
          </div>
        </form>
      </section>

      {/* 단어 리스트 */}
      <Reorder.Group axis="y" values={cards} onReorder={handleReorder} style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {cards.map((card) => (
          <Reorder.Item 
            key={card.id} 
            value={card} 
            style={{ listStyle: 'none' }}
            initial={false} // 초기 애니메이션 비활성화 (깜빡임 방지)
          >
            <div className={`card ${editingCard?.id === card.id ? 'editing' : ''}`} style={{ 
              display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.2rem',
              background: editingCard?.id === card.id ? 'rgba(99,102,241,0.05)' : 'var(--card-bg)',
              borderColor: editingCard?.id === card.id ? 'var(--accent-color)' : 'var(--glass-border)',
              transition: 'background-color 0.2s, border-color 0.2s' // 색상만 부드럽게
            }}>
              <div style={{ cursor: 'grab', color: 'var(--text-secondary)' }}><GripVertical size={20} /></div>
              
              <div style={{ flex: 1, position: 'relative', minHeight: editingCard?.id === card.id ? '250px' : 'auto' }}>
                <AnimatePresence mode="wait">
                  {editingCard?.id === card.id ? (
                    // 수정 모드
                    <motion.form 
                      key="edit"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      onSubmit={handleUpdateCard} 
                      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                    >
                      <div className="input-row">
                        <textarea className="legible-input" style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '1rem', minHeight: '100px', resize: 'vertical' }} value={editingCard.word} onChange={(e) => setEditingCard({ ...editingCard, word: e.target.value })} />
                        <textarea className="legible-input" style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '1rem', minHeight: '100px', resize: 'vertical' }} value={editingCard.meaning} onChange={(e) => setEditingCard({ ...editingCard, meaning: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', justifyContent: 'flex-end' }}>
                         <label style={{ cursor: 'pointer', color: 'var(--accent-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ImageIcon size={16} /> 이미지 변경
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageChange(e, true)} />
                         </label>
                         <button type="button" onClick={() => setEditingCard(null)} style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>취소</button>
                         <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}>저장</button>
                      </div>
                    </motion.form>
                  ) : (
                    // 일반 모드
                    <motion.div 
                      key="view"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', width: '100%' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.3rem', whiteSpace: 'pre-wrap' }}>{card.word}</div>
                        <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: '400', opacity: 0.85, whiteSpace: 'pre-wrap' }}>{card.meaning}</div>
                      </div>
                      {card.image_url && (
                        <div onClick={() => setZoomedImage(card.image_url)} style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', flexShrink: 0, cursor: 'zoom-in' }}>
                          <img src={card.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                        <button onClick={() => setEditingCard({ ...card, image: null, preview: card.image_url })} className="btn-hover-icon" style={{ background: 'none', color: 'var(--text-secondary)', padding: '0.6rem', cursor: 'pointer' }} title="수정"><Edit2 size={18} /></button>
                        <button onClick={() => handleDeleteCard(card.id, card.image_url)} className="btn-hover-danger" style={{ background: 'none', color: 'rgba(244, 63, 94, 0.4)', padding: '0.6rem', cursor: 'pointer' }} title="삭제"><Trash2 size={18} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <style>{`
        .input-row { display: flex; flex-direction: column; gap: 1rem; }
        .legible-input { font-family: inherit; font-size: 0.95rem; line-height: 1.5; }
        .btn-hover-icon:hover { color: var(--accent-color) !important; }
        .btn-hover-danger:hover { color: var(--danger) !important; background: rgba(244, 63, 94, 0.05) !important; border-radius: 8px; }
        @media (max-width: 600px) {
          .container { padding: 1rem; }
          .card { padding: 1rem; }
        }
      `}</style>
    </div>
  )
}
