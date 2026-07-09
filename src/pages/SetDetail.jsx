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

  // 단어 사이 인라인 삽입 관련 상태
  const [insertingIndex, setInsertingIndex] = useState(null)

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

  const handleImageChange = useCallback((e) => {
    const file = e.target.files[0]
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setNewCard(prev => ({ ...prev, image: file, preview: previewUrl }))
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

  const handleInsertCard = useCallback(async (index, insertData) => {
    try {
      let image_url = null
      if (insertData.image) image_url = await uploadImage(insertData.image)
      
      const { data, error } = await supabase.from('cards').insert([{
        set_id: id, 
        word: insertData.word, 
        meaning: insertData.meaning, 
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
      
      // display_order 재정렬은 백그라운드에서 처리 (UI 차단 없음)
      if (updatedCards) {
        const updates = updatedCards.map((card, idx) => ({ id: card.id, display_order: idx }))
        for (const update of updates) {
          await supabase.from('cards').update({ display_order: update.display_order }).eq('id', update.id)
        }
      }
    } catch (error) {
      alert('단어 추가 실패: ' + error.message)
      throw error
    }
  }, [id])

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

  const handleUpdateCard = useCallback(async (updatedCard) => {
    try {
      let image_url = updatedCard.image_url
      if (updatedCard.image) image_url = await uploadImage(updatedCard.image)
      const { error } = await supabase.from('cards').update({
        word: updatedCard.word, meaning: updatedCard.meaning, image_url
      }).eq('id', updatedCard.id)
      if (error) throw error
      setCards(prev => prev.map(c => c.id === updatedCard.id ? { ...updatedCard, image_url } : c))
    } catch (error) {
      alert(error.message)
      throw error
    }
  }, [])

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
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={zoomedImage} className="zoom-modal-img" />
            <button className="zoom-modal-close"><X size={24} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="set-detail-header">
        <Link to="/" className="back-to-dashboard-btn">
          <ArrowLeft size={18} /> <span className="nav-text">세트 목록</span>
        </Link>
        <div className="header-title-section">
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
          <div className="header-set-meta">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>총 {cards.length}개의 단어</p>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem' }}>|</span>
            <button
              onClick={handleTogglePublic}
              disabled={actionLoading}
              className="public-toggle-btn"
              style={{
                color: set.is_public ? 'var(--accent-color)' : 'var(--text-secondary)'
              }}
              title={set.is_public ? "공개 설정됨 (클릭 시 비공개 전환)" : "비공개 설정됨 (클릭 시 공개 전환)"}
            >
              {set.is_public ? <><Globe size={14} /> 전체 공개</> : <><Lock size={14} /> 비공개</>}
            </button>
          </div>
        </div>
      </header>

      {/* 단어 추가 폼 */}
      <section className="card add-card-section">
        <h3 className="section-title">
          <Plus size={18} color="var(--accent-color)" /> 새로운 단어 추가
        </h3>
        <form onSubmit={handleAddCard} className="add-card-form">
          <div className="input-row">
            <textarea
              className="legible-input"
              style={{ minHeight: '120px' }}
              placeholder="단어/개념 (예: Apple)"
              value={newCard.word}
              onChange={(e) => setNewCard({ ...newCard, word: e.target.value })}
            />
            <textarea
              className="legible-input"
              style={{ minHeight: '120px' }}
              placeholder="뜻/설명 (예: 사과)"
              value={newCard.meaning}
              onChange={(e) => setNewCard({ ...newCard, meaning: e.target.value })}
            />
          </div>
          <div className="form-footer">
            <label className="image-upload-label">
              <ImageIcon size={18} /> {newCard.image ? '이미지 교체' : '이미지 첨부'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImageChange(e)} />
            </label>
            {newCard.preview && (
              <div onClick={() => setZoomedImage(newCard.preview)} className="preview-image-container">
                <img src={newCard.preview} className="preview-image" />
                <button type="button" onClick={(e) => { e.stopPropagation(); setNewCard({ ...newCard, image: null, preview: null }); }} className="preview-remove-btn"><X size={12} /></button>
              </div>
            )}
            <button type="submit" className="btn-primary add-submit-btn" disabled={actionLoading}>
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : '추가하기'}
            </button>
          </div>
        </form>
      </section>

      {/* 단어 리스트 — gap: 0, 카드 사이 간격은 insert-separator 자체가 담당 */}
      <Reorder.Group axis="y" values={cards} onReorder={handleReorder} className="card-list-group">
        {cards.map((card, idx) => (
          <React.Fragment key={card.id}>
            {/* 인라인 삽입 폼: 해당 인덱스 위에 펼쳐짐 */}
            {insertingIndex === idx && (
              <InlineInsertForm
                index={idx}
                onInsert={handleInsertCard}
                onCancel={() => setInsertingIndex(null)}
                setZoomedImage={setZoomedImage}
              />
            )}

            <CardItem 
              card={card}
              index={idx}
              toggleMemorized={toggleMemorized}
              handleDeleteCard={handleDeleteCard}
              handleUpdateCard={handleUpdateCard}
              setZoomedImage={setZoomedImage}
            />

            {/* 카드 사이 구분자 — 호버 시 추가 버튼 노출 */}
            {idx < cards.length - 1 && (
              <div 
                className="insert-separator"
                onClick={() => {
                  setInsertingIndex(idx + 1)
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
      {cards.length > 0 && insertingIndex === cards.length && (
        <InlineInsertForm
          index={cards.length}
          onInsert={handleInsertCard}
          onCancel={() => setInsertingIndex(null)}
          setZoomedImage={setZoomedImage}
        />
      )}

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
  index,
  toggleMemorized, 
  handleDeleteCard, 
  handleUpdateCard, 
  setZoomedImage
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editingCard, setEditingCard] = useState({ word: '', meaning: '', image: null, preview: null, image_url: '' })
  const [localLoading, setLocalLoading] = useState(false)

  const handleStartEdit = () => {
    setEditingCard({
      ...card,
      image: null,
      preview: card.image_url
    })
    setIsEditing(true)
  }

  const handleLocalImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setEditingCard(prev => ({
        ...prev,
        image: file,
        preview: URL.createObjectURL(file)
      }))
    }
  }

  const handleLocalSubmit = async (e) => {
    e.preventDefault()
    setLocalLoading(true)
    try {
      await handleUpdateCard(editingCard)
      setIsEditing(false)
    } catch (err) {
      // 상위 부모에서 에러를 경고 처리하므로 캐치만 해둠
    } finally {
      setLocalLoading(false)
    }
  }

  return (
    <Reorder.Item 
      value={card} 
      className="card-list-item-wrapper"
      initial={false}
    >
      <div className={`card card-list-item ${isEditing ? 'editing' : ''}`}>
        <div className="drag-handle" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <GripVertical size={20} />
          <span className="card-number-badge" style={{
            fontSize: '0.75rem',
            fontWeight: '800',
            color: 'var(--text-secondary)',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 6px',
            borderRadius: '4px',
            minWidth: '18px',
            textAlign: 'center'
          }}>{index + 1}</span>
        </div>
        
        <div className={`card-item-content ${isEditing ? 'editing' : ''}`}>
          <AnimatePresence mode="wait">
            {isEditing ? (
              // 수정 모드
              <motion.form 
                key="edit"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onSubmit={handleLocalSubmit} 
                className="edit-form"
              >
                <div className="input-row">
                  <textarea className="legible-input" style={{ minHeight: '100px' }} value={editingCard.word} onChange={(e) => setEditingCard({ ...editingCard, word: e.target.value })} />
                  <textarea className="legible-input" style={{ minHeight: '100px' }} value={editingCard.meaning} onChange={(e) => setEditingCard({ ...editingCard, meaning: e.target.value })} />
                </div>
                <div className="edit-form-footer">
                   <label className="edit-image-upload-label">
                      <ImageIcon size={16} /> 이미지 추가/변경
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLocalImageChange} />
                   </label>
                   {editingCard.preview && (
                     <div onClick={() => setZoomedImage(editingCard.preview)} className="inline-preview-container" style={{ margin: '0 0.5rem', cursor: 'zoom-in', position: 'relative', display: 'inline-block' }}>
                       <img src={editingCard.preview} className="preview-image" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                       <button type="button" onClick={(e) => { e.stopPropagation(); setEditingCard({ ...editingCard, image: null, preview: null, image_url: null }); }} className="inline-preview-remove-btn" style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', border: 'none', borderRadius: '50%', width: '14px', height: '14px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={8} /></button>
                     </div>
                   )}
                   <button type="button" onClick={() => setIsEditing(false)} className="edit-cancel-btn" disabled={localLoading}>취소</button>
                   <button type="submit" className="btn-primary edit-save-btn" disabled={localLoading}>
                     {localLoading ? <Loader2 className="animate-spin" size={16} /> : '저장'}
                   </button>
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
              >
                <div className="card-text-container">
                  <div className="card-word">{card.word}</div>
                  <div className="card-meaning">{card.meaning}</div>
                </div>
                {card.image_url && (
                  <div onClick={() => setZoomedImage(card.image_url)} className="card-image-thumbnail">
                    <img src={card.image_url} alt="" />
                  </div>
                )}
                
                {/* 컨트롤 영역: 세그먼트 컨트롤 + 편집/삭제 버튼 */}
                <div className="card-controls">
                  {/* 암기 여부 세그먼트 */}
                  <div className="memorized-segment">
                    <button 
                      type="button"
                      onClick={() => {
                        if (card.is_memorized) {
                          toggleMemorized(card.id, true)
                        }
                      }} 
                      className={`segment-btn ${!card.is_memorized ? 'active-study' : ''}`}
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
                      className={`segment-btn ${card.is_memorized ? 'active-memorized' : ''}`}
                      title="암기 완료"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
   
                  <div className="card-actions-wrapper">
                    <button onClick={handleStartEdit} className="action-icon-btn btn-hover-icon" title="수정"><Edit2 size={18} /></button>
                    <button onClick={() => handleDeleteCard(card.id, card.image_url)} className="action-danger-btn btn-hover-danger" title="삭제"><Trash2 size={18} /></button>
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

const InlineInsertForm = memo(({ index, onInsert, onCancel, setZoomedImage }) => {
  const [word, setWord] = useState('')
  const [meaning, setMeaning] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [localLoading, setLocalLoading] = useState(false)

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!word.trim() || !meaning.trim()) return
    setLocalLoading(true)
    try {
      await onInsert(index, { word, meaning, image })
    } catch (e) {
      // 상위 부모에서 에러를 처리하므로 여기선 처리 상태만 리셋
    } finally {
      setLocalLoading(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="card inline-insert-form"
      style={{ margin: '0.5rem 0' }}
    >
      <h4 className="inline-insert-title">
        <Plus size={14} /> 여기에 단어 추가하기
      </h4>
      <div className="input-row">
        <textarea
          className="legible-input inline-textarea"
          placeholder="단어/개념 (예: Apple)"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <textarea
          className="legible-input inline-textarea"
          placeholder="뜻/설명 (예: 사과)"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
        />
      </div>
      <div className="inline-form-footer">
        <label className="inline-image-upload-label">
          <ImageIcon size={16} /> {image ? '이미지 교체' : '이미지 첨부'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        </label>
        {preview && (
          <div onClick={() => setZoomedImage(preview)} className="inline-preview-container">
            <img src={preview} className="preview-image" />
            <button type="button" onClick={(e) => { e.stopPropagation(); setImage(null); setPreview(null); }} className="inline-preview-remove-btn"><X size={10} /></button>
          </div>
        )}
        <div className="inline-actions-group">
          <button type="button" onClick={onCancel} className="inline-cancel-btn" disabled={localLoading}>취소</button>
          <button type="button" className="btn-primary inline-submit-btn" disabled={localLoading} onClick={handleSubmit}>
            {localLoading ? <Loader2 className="animate-spin" size={16} /> : '추가하기'}
          </button>
        </div>
      </div>
    </motion.div>
  )
});

