import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Plus, Trash2, Save, Edit2, X } from 'lucide-react'

export default function SetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [set, setSet] = useState(null)
  const [cards, setCards] = useState([])
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [loading, setLoading] = useState(true)

  // 수정 관련 상태
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
        .order('created_at', { ascending: true })
      
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

    try {
      const { data, error } = await supabase
        .from('cards')
        .insert([{ set_id: id, word: newWord, meaning: newMeaning }])
        .select()
      
      if (error) throw error
      setCards([...cards, data[0]])
      setNewWord('')
      setNewMeaning('')
    } catch (error) {
      alert(error.message)
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
        {cards.map((card) => (
          <div key={card.id} className="card" style={{ padding: '1.2rem', transition: 'all 0.2s' }}>
            {editingId === card.id ? (
              /* 수정 모드 */
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
              /* 일반 모드 */
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 2fr auto', alignItems: 'flex-start', gap: '1.5rem' }}>
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
        ))}
        {cards.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem', background: 'var(--glass)', borderRadius: '16px' }}>
            등록된 단어가 없습니다. 위 양식을 통해 첫 단어를 추가해 보세요!
          </p>
        )}
      </div>
    </div>
  )
}
