import React, { useState, useEffect, useCallback, memo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, Reorder, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, Plus, Trash2, Save, GripVertical, 
  Image as ImageIcon, X, Loader2, BookOpen, Clock, Edit2,
  Globe, Lock, CheckCircle2
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

  // 단어 사이 인라인 삽입 관련 상태
  const [insertingIndex, setInsertingIndex] = useState(null)
  const [insertCardData, setInsertCardData] = useState({ word: '', meaning: '', image: null, preview: null })
  const [insertLoading, setInsertLoading] = useState(false)

  // 세트 제목 인라인 편집 관련 상태
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [titleLoading, setTitleLoading] = useState(false)

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

  const handleTogglePublic = useCallback(async () => {
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
  }, [actionLoading, set, id])

  const handleUpdateTitle = useCallback(async () => {
    if (!titleInput.trim()) return
    if (titleInput.trim() === set.title) { setEditingTitle(false); return }
    setTitleLoading(true)
    try {
      const { error } = await supabase
        .from('word_sets')
        .update({ title: titleInput.trim() })
        .eq('id', id)
      if (error) throw error
      setSet({ ...set, title: titleInput.trim() })
      setEditingTitle(false)
    } catch (error) {
      alert('세트 이름 수정 실패: ' + error.message)
    } finally {
      setTitleLoading(false)
    }
  }, [titleInput, set, id])

  const handleDeleteSet = useCallback(async () => {
    if (!confirm(`"${set.title}" 세트를 삭제하시겠습니까?\n모든 단어 카드도 함께 삭제됩니다.`)) return
    setActionLoading(true)
    try {
      const imageFileNames = cards.filter(c => c.image_url).map(c => c.image_url.split('/').pop())
      if (imageFileNames.length > 0) {
        await supabase.storage.from('word-images').remove(imageFileNames)
      }
      await supabase.from('cards').delete().eq('set_id', id)
      const { error } = await supabase.from('word_sets').delete().eq('id', id)
      if (error) throw error
      navigate('/')
    } catch (error) {
      alert('세트 삭제 실패: ' + error.message)
      setActionLoading(false)
    }
  }, [set, cards, id, navigate])

  const toggleMemorized = useCallback(async (cardId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('cards')
        .update({ is_memorized: !currentStatus })
        .eq('id', cardId)
      
      if (error) throw error
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_memorized: !currentStatus } : c))
    } catch (error) {
      alert('카드 암기 여부 업데이트 실패: ' + error.message)
    }
  }, [])

  const handleImageChange = useCallback((e, isEdit = false) => {
    const file = e.target.files[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      if (isEdit) {
        setEditingCard(prev => ({ ...prev, image: file, preview: previewUrl }))
      } else {
        setNewCard(prev => ({ ...prev, image: file, preview: previewUrl }))
      }
    }
  }, [])

  const uploadImage = async (file) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${fileName}`
    const { error: uploadError } = await supabase.storage.from('word-images').upload(filePath, file)
    if (uploadError) throw uploadError
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/word-images/${filePath}`
  }

  const handleAddCard = useCallback(async (e) => {
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
      setCards(prev => [...prev, data[0]])
      setNewCard({ word: '', meaning: '', image: null, preview: null })
    } catch (error) {
      alert(error.message)
    } finally {
      setActionLoading(false)
    }
  }, [newCard, id, cards.length])

  const handleInsertCard = useCallback(async (index) => {
    if (!insertCardData.word.trim() || !insertCardData.meaning.trim()) return
    setInsertLoading(true)
    try {
      let image_url = null
      if (insertCardData.image) image_url = await uploadImage(insertCardData.image)
      
      const { data, error } = await supabase.from('cards').insert([{
        set_id: id, 
        word: insertCardData.word, 
        meaning: insertCardData.meaning, 
        image_url, 
        display_order: index
      }]).select()
      
      if (error) throw error
      
      const newCreatedCard = data[0]
      let updatedCards;
      setCards(prev => {
        const copy = [...prev]
        copy.splice(index, 0, newCreatedCard)
        updatedCards = copy
        return copy
      })
      
      // UI 즉시 업데이트 및 폼 닫기
      setInsertingIndex(null)
      setInsertCardData({ word: '', meaning: '', image: null, preview: null })
      setInsertLoading(false)
      
      // display_order 재정렬은 백그라운드에서 처리 (UI 차단 없음)
      if (updatedCards) {
        const updates = updatedCards.map((card, idx) => ({ id: card.id, display_order: idx }))
        for (const update of updates) {
          await supabase.from('cards').update({ display_order: update.display_order }).eq('id', update.id)
        }
      }
    } catch (error) {
      alert('단어 추가 실패: ' + error.message)
      setInsertLoading(false)
    }
  }, [insertCardData, id])

  const renderInlineInsertForm = (index) => {
    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        exit={{ opacity: 0, y: -10 }}
        className="card"
        style={{
          background: 'rgba(99, 102, 241, 0.04)',
          border: '2px dashed var(--accent-color)',
          padding: '1.2rem',
          margin: '0 0 0.5rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
          <Plus size={14} /> 여기에 단어 추가하기
        </h4>
        <div className="input-row">
          <textarea
            className="legible-input"
            style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '0.8rem', minHeight: '80px', resize: 'vertical' }}
            placeholder="단어/개념 (예: Apple)"
            value={insertCardData.word}
            onChange={(e) => setInsertCardData({ ...insertCardData, word: e.target.value })}
          />
          <textarea
            className="legible-input"
            style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '0.8rem', minHeight: '80px', resize: 'vertical' }}
            placeholder="뜻/설명 (예: 사과)"
            value={insertCardData.meaning}
            onChange={(e) => setInsertCardData({ ...insertCardData, meaning: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.8rem', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
            <ImageIcon size={16} /> {insertCardData.image ? '이미지 교체' : '이미지 첨부'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
              const file = e.target.files[0]
              if (file) {
                setInsertCardData({ ...insertCardData, image: file, preview: URL.createObjectURL(file) })
              }
            }} />
          </label>
          {insertCardData.preview && (
            <div onClick={() => setZoomedImage(insertCardData.preview)} style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', cursor: 'zoom-in' }}>
              <img src={insertCardData.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={(e) => { e.stopPropagation(); setInsertCardData({ ...insertCardData, image: null, preview: null }); }} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '2px', border: 'none' }}><X size={10} /></button>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={() => setInsertingIndex(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem 1rem' }}>취소</button>
            <button type="button" className="btn-primary" disabled={insertLoading} onClick={() => handleInsertCard(index)} style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}>
              {insertLoading ? <Loader2 className="animate-spin" size={16} /> : '추가하기'}
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const handleDeleteCard = useCallback(async (cardId, imageUrl) => {
    if (!confirm('단어를 삭제하시겠습니까?')) return
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId)
      if (error) throw error
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop()
        await supabase.storage.from('word-images').remove([fileName])
      }
      setCards(prev => prev.filter(c => c.id !== cardId))
    } catch (error) {
      alert(error.message)
    }
  }, [])

  const handleUpdateCard = useCallback(async (e) => {
    e.preventDefault()
    if (!editingCard) return
    setActionLoading(true)
    try {
      let image_url = editingCard.image_url
      if (editingCard.image) image_url = await uploadImage(editingCard.image)
      const { error } = await supabase.from('cards').update({
        word: editingCard.word, meaning: editingCard.meaning, image_url
      }).eq('id', editingCard.id)
      if (error) throw error
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...editingCard, image_url } : c))
      setEditingCard(null)
    } catch (error) {
      alert(error.message)
    } finally {
      setActionLoading(false)
    }
  }, [editingCard])

  const handleReorder = useCallback(async (newOrder) => {
    setCards(newOrder)
    const updates = newOrder.map((card, index) => ({ id: card.id, display_order: index }))
    for (const update of updates) {
      await supabase.from('cards').update({ display_order: update.display_order }).eq('id', update.id)
    }
  }, [])

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

      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, paddingTop: '0.4rem' }}>
          <ArrowLeft size={18} /> <span className="nav-text">세트 목록</span>
        </Link>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          {editingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateTitle()
                  if (e.key === 'Escape') setEditingTitle(false)
                }}
                style={{
                  background: 'var(--glass)',
                  border: '1.5px solid var(--accent-color)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '0.4rem 0.8rem',
                  fontSize: '1.4rem',
                  fontWeight: '700',
                  fontFamily: 'inherit',
                  outline: 'none',
                  width: '100%',
                  maxWidth: '450px',
                  textAlign: 'right'
                }}
              />
              <button
                onClick={handleUpdateTitle}
                disabled={titleLoading}
                style={{ background: 'var(--accent-color)', border: 'none', borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}
                title="저장"
              >
                {titleLoading ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              </button>
              <button
                onClick={() => setEditingTitle(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0.4rem' }}
                title="취소"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{set.title}</h2>
              <button
                onClick={() => { setTitleInput(set.title); setEditingTitle(true) }}
                className="btn-hover-icon"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }}
                title="세트 이름 수정"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={handleDeleteSet}
                disabled={actionLoading}
                className="btn-hover-danger"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(244, 63, 94, 0.45)', display: 'flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }}
                title="세트 삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
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
              placeholder="단어/개념 (예: Apple)"
              value={newCard.word}
              onChange={(e) => setNewCard({ ...newCard, word: e.target.value })}
            />
            <textarea
              className="legible-input"
              style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '1.2rem', minHeight: '120px', resize: 'vertical' }}
              placeholder="뜻/설명 (예: 사과)"
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

      {/* 단어 리스트 — gap: 0, 카드 사이 간격은 insert-separator 자체가 담당 */}
      <Reorder.Group axis="y" values={cards} onReorder={handleReorder} style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {cards.map((card, idx) => (
          <React.Fragment key={card.id}>
            {/* 인라인 삽입 폼: 해당 인덱스 위에 펼쳐짐 */}
            {insertingIndex === idx && renderInlineInsertForm(idx)}

            <CardItem 
              card={card}
              isEditing={editingCard?.id === card.id}
              editingCard={editingCard}
              setEditingCard={setEditingCard}
              toggleMemorized={toggleMemorized}
              handleDeleteCard={handleDeleteCard}
              handleUpdateCard={handleUpdateCard}
              handleImageChange={handleImageChange}
              setZoomedImage={setZoomedImage}
            />

            {/* 카드 사이 구분자 — 호버 시 추가 버튼 노출 */}
            {idx < cards.length - 1 && (
              <div 
                className="insert-separator"
                onClick={() => {
                  setInsertingIndex(idx + 1)
                  setInsertCardData({ word: '', meaning: '', image: null, preview: null })
                }}
              >
                <div className="insert-separator-line" />
                <button type="button" className="insert-separator-btn">
                  <Plus size={12} /> 단어 추가
                </button>
              </div>
            )}
          </React.Fragment>
        ))}
      </Reorder.Group>

      {/* 마지막 카드 아래 인라인 추가 폼 */}
      {cards.length > 0 && insertingIndex === cards.length && renderInlineInsertForm(cards.length)}

      <style>{`
        .input-row { display: flex; flex-direction: column; gap: 1rem; }
        .legible-input { font-family: inherit; font-size: 0.95rem; line-height: 1.5; }
        .btn-hover-icon:hover { color: var(--accent-color) !important; }
        .btn-hover-danger:hover { color: var(--danger) !important; background: rgba(244, 63, 94, 0.05) !important; border-radius: 8px; }
        
        .insert-separator {
          position: relative;
          height: 8px;
          padding: 6px 0; /* 시각적 gap은 8px, 실제 호버 감지 영역은 8+14*2=36px */
          margin: 0 0; /* padding만큼 보정하여 레이아웃 공간은 8px 유지 */
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5;
        }
        .insert-separator-line {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%) scaleX(0);
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, var(--accent-color) 50%, transparent 100%);
          pointer-events: none;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .insert-separator:hover .insert-separator-line {
          transform: translateY(-50%) scaleX(1);
        }
        .insert-separator-btn {
          position: relative;
          z-index: 1;
          background: var(--card-bg);
          border: 1px solid var(--accent-color);
          color: var(--accent-color);
          padding: 0.25rem 0.7rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          opacity: 0;
          transform: scale(0.8);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
          transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .insert-separator:hover .insert-separator-btn {
          opacity: 1;
          transform: scale(1);
        }

        @media (max-width: 600px) {
          .container { padding: 1rem; }
          .card { padding: 1rem; }
          .nav-text { display: none; }
          .card-view-layout {
            flex-direction: column;
            align-items: stretch !important;
            gap: 1rem !important;
          }
          .card-controls {
            margin-left: 0 !important;
            justify-content: space-between;
            width: 100%;
            border-top: 1px solid var(--glass-border);
            padding-top: 0.8rem;
          }
        }
      `}</style>
    </div>
  )
}

const CardItem = memo(({ 
  card, 
  isEditing, 
  editingCard, 
  setEditingCard, 
  toggleMemorized, 
  handleDeleteCard, 
  handleUpdateCard, 
  handleImageChange,
  setZoomedImage
}) => {
  return (
    <Reorder.Item 
      value={card} 
      style={{ listStyle: 'none' }}
      initial={false}
    >
      <div className={`card ${isEditing ? 'editing' : ''}`} style={{ 
        display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.2rem',
        background: isEditing ? 'rgba(99,102,241,0.05)' : 'var(--card-bg)',
        borderColor: isEditing ? 'var(--accent-color)' : 'var(--glass-border)',
        transition: 'background-color 0.2s, border-color 0.2s'
      }}>
        <div style={{ cursor: 'grab', color: 'var(--text-secondary)' }}><GripVertical size={20} /></div>
        
        <div style={{ flex: 1, position: 'relative', minHeight: isEditing ? '250px' : 'auto' }}>
          <AnimatePresence mode="wait">
            {isEditing ? (
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
                      <ImageIcon size={16} /> 이미지 추가/변경
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
                className="card-view-layout"
                style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%' }}
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
                
                {/* 컨트롤 영역: 세그먼트 컨트롤 + 편집/삭제 버튼 */}
                <div className="card-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0, marginLeft: 'auto' }}>
                  {/* 암기 여부 세그먼트 */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      background: 'rgba(0, 0, 0, 0.3)', 
                      padding: '3px', 
                      borderRadius: '10px', 
                      border: '1px solid var(--glass-border)',
                      userSelect: 'none',
                      height: '42px',
                      alignItems: 'center',
                      gap: '3px',
                      flexShrink: 0
                    }}
                  >
                    <button 
                      type="button"
                      onClick={() => {
                        if (card.is_memorized) {
                          toggleMemorized(card.id, true)
                        }
                      }} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        borderRadius: '8px',
                        width: '34px',
                        height: '34px',
                        background: !card.is_memorized ? 'var(--accent-color)' : 'transparent',
                        color: !card.is_memorized ? 'white' : 'rgba(255, 255, 255, 0.35)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      title="학습 중"
                    >
                      <BookOpen size={18} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (!card.is_memorized) {
                          toggleMemorized(card.id, false)
                        }
                      }} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        borderRadius: '8px',
                        width: '34px',
                        height: '34px',
                        background: card.is_memorized ? 'var(--success)' : 'transparent',
                        color: card.is_memorized ? 'white' : 'rgba(255, 255, 255, 0.35)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: card.is_memorized ? '0 2px 6px rgba(21, 128, 61, 0.25)' : 'none'
                      }}
                      title="암기 완료"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
  
                  <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    <button onClick={() => setEditingCard({ ...card, image: null, preview: card.image_url })} className="btn-hover-icon" style={{ background: 'none', color: 'var(--text-secondary)', padding: '0.6rem', cursor: 'pointer' }} title="수정"><Edit2 size={18} /></button>
                    <button onClick={() => handleDeleteCard(card.id, card.image_url)} className="btn-hover-danger" style={{ background: 'none', color: 'rgba(244, 63, 94, 0.4)', padding: '0.6rem', cursor: 'pointer' }} title="삭제"><Trash2 size={18} /></button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Reorder.Item>
  );
});

