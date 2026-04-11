import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Book, Trash2, ChevronRight, LogOut } from 'lucide-react'

export default function Dashboard({ session }) {
  const [sets, setSets] = useState([])
  const [newSetName, setNewSetName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSets()
  }, [])

  const fetchSets = async () => {
    try {
      const { data, error } = await supabase
        .from('word_sets')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSets(data || [])
    } catch (error) {
      console.error('Error fetching sets:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSet = async (e) => {
    e.preventDefault()
    if (!newSetName.trim()) return

    try {
      const { data, error } = await supabase
        .from('word_sets')
        .insert([{ title: newSetName, user_id: session.user.id }])
        .select()
      
      if (error) throw error
      setSets([data[0], ...sets])
      setNewSetName('')
    } catch (error) {
      alert(error.message)
    }
  }

  const handleDeleteSet = async (id) => {
    if (!confirm('정말 이 세트를 삭제하시겠습니까? 관련 단어들도 모두 삭제됩니다.')) return
    
    try {
      const { error } = await supabase.from('word_sets').delete().eq('id', id)
      if (error) throw error
      setSets(sets.filter(s => s.id !== id))
    } catch (error) {
      alert(error.message)
    }
  }

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3.5rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2rem', fontWeight: '800' }}>나의 암기장</h1>
          <p style={{ color: 'var(--text-secondary)' }}>공부할 단어 세트를 선택하거나 새로 만드세요.</p>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ background: 'var(--glass)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
        >
          <LogOut size={18} /> 로그아웃
        </button>
      </header>

      <section style={{ marginBottom: '3rem' }}>
        <form onSubmit={handleCreateSet} style={{ display: 'flex', gap: '1rem', maxWidth: '600px' }}>
          <input
            className="card"
            style={{ flex: 1, padding: '1rem', background: 'var(--glass)', color: 'white', border: '1px solid var(--glass-border)' }}
            type="text"
            placeholder="새로운 단어 세트 제목 (예: 토익 보카)"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} /> 만들기
          </button>
        </form>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {loading ? (
          <p>로딩 중...</p>
        ) : sets.length === 0 ? (
          <p style={{ gridColumn: '1/-1', color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem' }}>
            아직 생성된 단어 세트가 없습니다. 새로운 세트를 만들어 보세요!
          </p>
        ) : (
          sets.map((set) => (
            <div key={set.id} className="card animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--accent-color)', padding: '0.6rem', borderRadius: '12px' }}>
                    <Book size={20} color="white" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem' }}>{set.title}</h3>
                </div>
                <button 
                  onClick={() => handleDeleteSet(set.id)}
                  style={{ background: 'none', color: 'var(--text-secondary)' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1, fontSize: '0.9rem', padding: '0.6rem' }}
                  onClick={() => window.location.href = `/set/${set.id}`}
                >
                  학습 시작
                </button>
                <button 
                  style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'white', padding: '0.6rem' }}
                  onClick={() => window.location.href = `/set/${set.id}/manage`}
                >
                  관리
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
