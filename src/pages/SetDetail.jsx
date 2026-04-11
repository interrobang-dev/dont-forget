import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Plus, Trash2, Save, Edit2 } from 'lucide-react'

export default function SetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [set, setSet] = useState(null)
  const [cards, setCards] = useState([])
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [loading, setLoading] = useState(true)

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

  const handleDeleteCard = async (cardId) => {
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId)
      if (error) throw error
      setCards(cards.filter(c => c.id !== cardId))
    } catch (error) {
      alert(error.message)
    }
  }

  if (loading) return <div className="container">로딩 중...</div>

  return (
    <div className="container">
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> 대시보드로 돌아가기
        </Link>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>{set.title} 관리</h1>
      </div>

      <section className="card" style={{ marginBottom: '2rem', background: 'rgba(99, 102, 241, 0.05)' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>새 단어 추가</h3>
        <form onSubmit={handleAddCard} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem' }}>
          <input
            className="card"
            style={{ padding: '0.8rem', background: 'var(--glass)', color: 'white' }}
            type="text"
            placeholder="단어 (앞면)"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
          />
          <input
            className="card"
            style={{ padding: '0.8rem', background: 'var(--glass)', color: 'white' }}
            type="text"
            placeholder="뜻 (뒷면)"
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
          />
          <button type="submit" className="btn-primary">추가하기</button>
        </form>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>저장된 단어 ({cards.length})</h3>
        {cards.map((card) => (
          <div key={card.id} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
            <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{card.word}</div>
            <div style={{ color: 'var(--text-secondary)' }}>{card.meaning}</div>
            <button 
              onClick={() => handleDeleteCard(card.id)}
              style={{ background: 'none', color: 'var(--danger)', padding: '0.5rem' }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {cards.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>아직 단어가 없습니다. 위에서 단어를 추가해 보세요!</p>
        )}
      </div>
    </div>
  )
}
