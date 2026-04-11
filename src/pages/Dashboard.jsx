import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Play, Settings, BookOpen, Shuffle, ArrowRightLeft, Loader2, Edit2 } from 'lucide-react'

export default function Dashboard() {
  const [sets, setSets] = useState([])
  const [newSetTitle, setNewSetTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  
  // 빠른 학습 설정 상태 (세트 ID별로 관리)
  const [quickSettings, setQuickSettings] = useState({}) 

  const navigate = useNavigate()

  useEffect(() => {
    fetchSets()
  }, [])

  const fetchSets = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('word_sets')
        .select(`
          *,
          cards(count)
        `)
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSets(data || [])
      
      // 초기 셋팅 (단어 우선, 순차적)
      const initialSettings = {}
      data.forEach(s => {
        initialSettings[s.id] = { direction: 'word', order: 'seq' }
      })
      setQuickSettings(initialSettings)

    } catch (error) {
      console.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSet = async (e) => {
    e.preventDefault()
    if (!newSetTitle.trim()) return
    setCreating(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('word_sets')
        .insert([{ title: newSetTitle, user_id: userData.user.id }])
        .select()
      
      if (error) throw error
      setSets([data[0], ...sets])
      setQuickSettings({ ...quickSettings, [data[0].id]: { direction: 'word', order: 'seq' } })
      setNewSetTitle('')
    } catch (error) {
      alert(error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSet = async (id) => {
    if (!confirm('세트와 포함된 모든 단어가 삭제됩니다. 계속하시겠습니까?')) return
    try {
      const { error } = await supabase.from('word_sets').delete().eq('id', id)
      if (error) throw error
      setSets(sets.filter(s => s.id !== id))
    } catch (error) {
      alert(error.message)
    }
  }

  const updateQuickSetting = (setId, key, value) => {
    setQuickSettings(prev => ({
      ...prev,
      [setId]: { ...prev[setId], [key]: value }
    }))
  }

  const startStudy = (setId) => {
    const config = quickSettings[setId]
    navigate(`/set/${setId}/study?dir=${config.direction}&ord=${config.order}`)
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 className="text-gradient" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>까먹지마!</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>자신만의 단어장을 만들고 스마트하게 학습하세요.</p>
      </header>

      <section className="card" style={{ marginBottom: '4rem', background: 'rgba(255,255,255,0.02)' }}>
        <form onSubmit={handleCreateSet} style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            className="card"
            style={{ flex: 1, background: 'var(--bg-color)', color: 'white', padding: '1rem 1.5rem', fontSize: '1.1rem' }}
            placeholder="새로운 단어 세트 이름을 입력하세요 (예: 토익 필수 단어)"
            value={newSetTitle}
            onChange={(e) => setNewSetTitle(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}>
            {creating ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> 세트 만들기</>}
          </button>
        </form>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.8rem' }}>나의 세트 목록</h2>
        {sets.map((set) => (
          <div key={set.id} className="card animate-fade" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.8rem' }}>
            <div style={{ flex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.4rem' }}>{set.title}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: '700', background: 'rgba(99,102,241,0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                   {set.cards[0]?.count || 0} cards
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>생성일: {new Date(set.created_at).toLocaleDateString()}</p>
            </div>

            {/* 빠른 학습 설정 영역 */}
            <div style={{ flex: 3, display: 'flex', justifyContent: 'center', gap: '1.5rem', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)', padding: '0 2rem', margin: '0 2rem' }}>
               {/* 방향 */}
               <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '10px' }}>
                  <button 
                    onClick={() => updateQuickSetting(set.id, 'direction', 'word')} 
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '7px', background: quickSettings[set.id]?.direction === 'word' ? 'var(--accent-color)' : 'transparent', color: quickSettings[set.id]?.direction === 'word' ? 'white' : 'var(--text-secondary)' }}
                  >
                    단어 우선
                  </button>
                  <button 
                    onClick={() => updateQuickSetting(set.id, 'direction', 'meaning')} 
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '7px', background: quickSettings[set.id]?.direction === 'meaning' ? 'var(--accent-color)' : 'transparent', color: quickSettings[set.id]?.direction === 'meaning' ? 'white' : 'var(--text-secondary)' }}
                  >
                    뜻 우선
                  </button>
               </div>
               {/* 순서 */}
               <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '10px' }}>
                  <button 
                    onClick={() => updateQuickSetting(set.id, 'order', 'seq')} 
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '7px', background: quickSettings[set.id]?.order === 'seq' ? 'var(--accent-color)' : 'transparent', color: quickSettings[set.id]?.order === 'seq' ? 'white' : 'var(--text-secondary)' }}
                  >
                    순서대로
                  </button>
                  <button 
                    onClick={() => updateQuickSetting(set.id, 'order', 'rand')} 
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '7px', background: quickSettings[set.id]?.order === 'rand' ? 'var(--accent-color)' : 'transparent', color: quickSettings[set.id]?.order === 'rand' ? 'white' : 'var(--text-secondary)' }}
                  >
                    무작위
                  </button>
               </div>
            </div>

            <div style={{ display: 'flex', flex: 1, gap: '1rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => startStudy(set.id)}
                className="btn-primary" 
                style={{ height: '45px', width: '45px', padding: 0, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                title="학습 시작"
              >
                <Play fill="white" size={20} />
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                <Link 
                  to={`/set/${set.id}/manage`} 
                  style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', display: 'flex', alignItems: 'center' }}
                  title="세트 관리"
                >
                  <Edit2 size={22} className="btn-hover" />
                </Link>
                <button 
                  onClick={() => handleDeleteSet(set.id)} 
                  style={{ background: 'none', color: 'rgba(244, 63, 94, 0.6)', padding: '0.5rem', display: 'flex', alignItems: 'center' }}
                  title="세트 삭제"
                >
                  <Trash2 size={22} className="btn-hover" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {sets.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem' }}>아직 등록된 세트가 없습니다. 새로운 세트를 만들어보세요!</p>
        )}
      </div>
    </div>
  )
}
