import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Reorder } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Save, Edit2, X, GripVertical as DragHandle, Image as ImageIcon, Loader2 } from 'lucide-react'

export default function SetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [set, setSet] = useState(null)
  const [cards, setCards] = useState([])
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [editWord, setEditWord] = useState('')
  const [editMeaning, setEditMeaning] = useState('')
  const [editImageFile, setEditImageFile] = useState(null)

  useEffect(() => {
    fetchSetAndCards()
  }, [id])

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from('word_sets')
        .select('*')
        .eq('id', id)
        .single()
      
      if (setError) throw setError
      setSet(setData)

      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', id)
        .order('display_order', { ascending: true })
      
      if (cardsError) throw cardsError
      setCards(cardsData || [])
    } catch (error) {
      console.error(error.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  // 공용 이미지 주소 생성 함수
  const createPublicImageUrl = (filePath) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')
    return `${baseUrl}/storage/v1/object/public/word-images/${filePath}`
  }

  const handleAddCard = async (e) => {
    e.preventDefault()
    if (!newWord.trim() || !newMeaning.trim()) return

    setUploading(true)
    let final_image_url = null

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('word-images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError
        final_image_url = createPublicImageUrl(fileName)
      }

      const nextOrder = cards.length > 0 ? Math.max(...cards.map(c => c.display_order)) + 1 : 0
      const { data, error } = await supabase
        .from('cards')
        .insert([{ 
          set_id: id, 
          word: newWord, 
          meaning: newMeaning, 
          display_order: nextOrder,
          image_url: final_image_url 
        }])
        .select()
      
      if (error) throw error
      setCards([...cards, data[0]])
      setNewWord('')
      setNewMeaning('')
      setImageFile(null)
      const fileInput = document.getElementById('image-input')
      if (fileInput) fileInput.value = ''
      
    } catch (error) {
      alert('저장 실패: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleReorder = async (newOrder) => {
    setCards(newOrder)
    const updates = newOrder.map((card, index) => ({
      id: card.id,
      set_id: id,
      word: card.word,
      meaning: card.meaning,
      display_order: index,
      image_url: card.image_url
    }))

    try {
      const { error } = await supabase.from('cards').upsert(updates)
      if (error) throw error
    } catch (error) {
      console.error('순서 저장 실패:', error.message)
    }
  }

  const startEditing = (card) => {
    setEditingId(card.id)
    setEditWord(card.word)
    setEditMeaning(card.meaning)
    setEditImageFile(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditWord('')
    setEditMeaning('')
    setEditImageFile(null)
  }

  const handleUpdateCard = async (card) => {
    if (!editWord.trim() || !editMeaning.trim()) return
    setUploading(true)

    let final_image_url = card.image_url

    try {
      // 새 이미지가 선택된 경우 업로드
      if (editImageFile) {
        const fileExt = editImageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('word-images')
          .upload(fileName, editImageFile)

        if (uploadError) throw uploadError
        
        // 이전 이미지 삭제 (선택 사항)
        if (card.image_url) {
          const oldFileName = card.image_url.split('/').pop()
          await supabase.storage.from('word-images').remove([oldFileName])
        }
        
        final_image_url = createPublicImageUrl(fileName)
      }

      const { error } = await supabase
        .from('cards')
        .update({ word: editWord, meaning: editMeaning, image_url: final_image_url })
        .eq('id', card.id)
      
      if (error) throw error
      
      setCards(cards.map(c => c.id === card.id ? { ...c, word: editWord, meaning: editMeaning, image_url: final_image_url } : c))
      setEditingId(null)
    } catch (error) {
      alert(error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteCard = async (card) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      if (card.image_url) {
        const fileName = card.image_url.split('/').pop()
        await supabase.storage.from('word-images').remove([fileName])
      }

      const { error } = await supabase.from('cards').delete().eq('id', card.id)
      if (error) throw error
      setCards(cards.filter(c => c.id !== card.id))
    } catch (error) {
      alert(error.message)
    }
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>

  return (
    <div className="container" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> 대시보드로 돌아가기
        </Link>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>{set?.title} 관리</h1>
      </div>

      <section className="card" style={{ marginBottom: '3rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid var(--accent-color)' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> 새 단어 추가
        </h3>
        <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>단어 (앞면)</label>
              <textarea
                className="card"
                style={{ height: '100px', padding: '1rem', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--glass-border)', resize: 'vertical' }}
                placeholder="단어나 문장"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>뜻 (뒷면)</label>
              <textarea
                className="card"
                style={{ height: '100px', padding: '1rem', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--glass-border)', resize: 'vertical' }}
                placeholder="의미나 설명"
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label htmlFor="image-input" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)', fontSize: '0.9rem' }}>
                <ImageIcon size={18} /> {imageFile ? imageFile.name : '이미지 첨부'}
              </label>
              <input id="image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setImageFile(e.target.files[0])} />
              {imageFile && <button type="button" onClick={() => setImageFile(null)} style={{ background: 'none', color: 'var(--danger)', fontSize: '0.8rem' }}>취소</button>}
            </div>
            <button type="submit" className="btn-primary" disabled={uploading} style={{ padding: '0.8rem 2.5rem' }}>
              {uploading ? <Loader2 className="animate-spin" /> : '세트에 추가하기'}
            </button>
          </div>
        </form>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>단어 목록 ({cards.length})</h3>
        <Reorder.Group axis="y" values={cards} onReorder={handleReorder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none', padding: 0 }}>
          {cards.map((card) => (
            <Reorder.Item key={card.id} value={card}>
              <div className="card" style={{ padding: '1.2rem', background: editingId === card.id ? 'var(--card-bg)' : 'rgba(255,255,255,0.03)' }}>
                {editingId === card.id ? (
                  /* 수정 모드 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <textarea className="card" style={{ padding: '0.8rem', background: 'var(--bg-color)', color: 'white', minHeight: '80px' }} value={editWord} onChange={(e) => setEditWord(e.target.value)} />
                      <textarea className="card" style={{ padding: '0.8rem', background: 'var(--bg-color)', color: 'white', minHeight: '80px' }} value={editMeaning} onChange={(e) => setEditMeaning(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label htmlFor={`edit-image-${card.id}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                          <ImageIcon size={16} /> {editImageFile ? editImageFile.name : '이미지 교체'}
                        </label>
                        <input id={`edit-image-${card.id}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setEditImageFile(e.target.files[0])} />
                        {card.image_url && !editImageFile && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>기존 이미지 있음</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={cancelEditing} style={{ background: 'var(--glass)', color: 'white', padding: '0.5rem 1rem' }}>취소</button>
                        <button onClick={() => handleUpdateCard(card)} className="btn-primary" disabled={uploading}>
                          {uploading ? <Loader2 className="animate-spin" /> : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 일반 모드 */
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 2fr auto', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ cursor: 'grab', color: 'var(--text-secondary)' }}><DragHandle size={20} /></div>
                    <div style={{ fontWeight: '700', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{card.word}</div>
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{card.meaning}</span>
                      {card.image_url && (
                        <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                          <img src={card.image_url} alt="card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => startEditing(card)} style={{ background: 'var(--glass)', color: 'var(--text-secondary)', padding: '0.5rem' }}><Edit2 size={18} /></button>
                      <button onClick={() => handleDeleteCard(card)} style={{ background: 'none', color: 'var(--danger)', padding: '0.5rem' }}><Trash2 size={18} /></button>
                    </div>
                  </div>
                )}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </div>
  )
}
