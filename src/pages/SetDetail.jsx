import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Reorder } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Save, Edit2, X, GripVertical as DragHandle } from 'lucide-react'

export default function SetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [set, setSet] = useState(null)
  const [cards, setCards] = useState([])
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [editWord, setEditWord] = useState('')
  const [editMeaning, setEditMeaning] = useState('')

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
        .order('display_order', { ascending: true }) // 순서대로 가져오기
      
      if (cardsError) throw cardsError
      setCards(cardsData || [])
    } catch (error) {
      console.error(error.message)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCard = async (e) => {
    e.preventDefault()
    if (!newWord.trim() || !newMeaning.trim()) return

    // 새 카드는 가장 마지막 순서로 추가
    const nextOrder = cards.length > 0 ? Math.max(...cards.map(c => c.display_order)) + 1 : 0

    try {
      const { data, error } = await supabase
        .from('cards')
        .insert([{ set_id: id, word: newWord, meaning: newMeaning, display_order: nextOrder }])
        .select()
      
      if (error) throw error
      setCards([...cards, data[0]])
      setNewWord('')
      setNewMeaning('')
    } catch (error) {
      alert(error.message)
    }
  }

  // 순서 변경 시 로컬 상태 업데이트 및 DB 반영
  const handleReorder = async (newOrder) => {
    setCards(newOrder)
    
    // DB에 새로운 순서 업데이트 (성능을 위해 실제 프로필에서는 디바운싱 등을 고려할 수 있음)
    const updates = newOrder.map((card, index) => ({
      id: card.id,
      set_id: id, // 필수 컬럼 대응
      word: card.word,
      meaning: card.meaning,
      display_order: index
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
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditWord('')
    setEditMeaning('')
  }

  const handleUpdateCard = async (cardId) => {
    if (!editWord.trim() || !editMeaning.trim()) return

    try {
      const { error } = await supabase
        .from('cards')
        .update({ word: editWord, meaning: editMeaning })
        .eq('id', cardId)
      
      if (error) throw error
      
      setCards(cards.map(c => c.id === cardId ? { ...c, word: editWord, meaning: editMeaning } : c))
      setEditingId(null)
    } catch (error) {
      alert(error.message)
    }
  }

  const handleDeleteCard = async (cardId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId)
      if (error) throw error
      setCards(cards.filter(c => c.id !== cardId))
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
                style={{ height: '120px', padding: '1rem', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--glass-border)', resize: 'vertical' }}
                placeholder="암기할 단어나 문장을 입력하세요"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>뜻 (뒷면)</label>
              <textarea
                className="card"
                style={{ height: '120px', padding: '1rem', background: 'var(--bg-color)', color: 'white', border: '1px solid var(--glass-border)', resize: 'vertical' }}
                placeholder="의미나 설명을 입력하세요"
                value={newMeaning}
                onChange={(e) => setNewMeaning(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end', padding: '0.8rem 2.5rem' }}>
            세트에 추가하기
          </button>
        </form>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>단어 목록 ({cards.length})</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>💡 각 단어를 드래그하여 순서를 바꿀 수 있습니다.</p>
        
        <Reorder.Group axis="y" values={cards} onReorder={handleReorder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none', padding: 0 }}>
          {cards.map((card) => (
            <Reorder.Item key={card.id} value={card} style={{ cursor: 'grab' }}>
              <div className="card" style={{ padding: '1.2rem', transition: 'box-shadow 0.2s', background: editingId === card.id ? 'var(--card-bg)' : 'rgba(255,255,255,0.03)' }}>
                {editingId === card.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <textarea
                        className="card"
                        style={{ padding: '0.8rem', background: 'var(--bg-color)', color: 'white', minHeight: '80px' }}
                        value={editWord}
                        onChange={(e) => setEditWord(e.target.value)}
                      />
                      <textarea
                        className="card"
                        style={{ padding: '0.8rem', background: 'var(--bg-color)', color: 'white', minHeight: '80px' }}
                        value={editMeaning}
                        onChange={(e) => setEditMeaning(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button onClick={cancelEditing} style={{ background: 'var(--glass)', color: 'white', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <X size={16} /> 취소
                      </button>
                      <button onClick={() => handleUpdateCard(card.id)} className="btn-primary" style={{ padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Save size={16} /> 저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 2fr auto', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{card.word}</div>
                    <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{card.meaning}</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => startEditing(card)} style={{ background: 'var(--glass)', color: 'var(--text-secondary)', padding: '0.5rem' }}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteCard(card.id)} style={{ background: 'none', color: 'var(--danger)', padding: '0.5rem' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {cards.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem', background: 'var(--glass)', borderRadius: '16px' }}>
            등록된 단어가 없습니다. 위 양식을 통해 첫 단어를 추가해 보세요!
          </p>
        )}
      </div>
    </div>
  )
}
