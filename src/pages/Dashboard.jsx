import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Play, Edit2, Clock, Layers, Loader2, ClipboardList, BookOpen, LogOut } from 'lucide-react'

export default function Dashboard({ session }) {
  const [sets, setSets] = useState([])
  const [newSetTitle, setNewSetTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [quickSettings, setQuickSettings] = useState({}) 

  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/login')
    } catch (error) {
      alert(error.message)
    }
  }

  useEffect(() => {
    fetchSets()
  }, [])

  const fetchSets = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('word_sets')
        .select(`*, cards(count)`)
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSets(data || [])
      
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
    const config = quickSettings[setId] || { direction: 'word', order: 'seq' }
    navigate(`/set/${setId}/study?dir=${config.direction}&ord=${config.order}`)
  }

  const startTest = (setId) => {
    navigate(`/set/${setId}/test`)
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <header style={{ marginBottom: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* 상단 로그인 정보 & 로그아웃 바 */}
        {session?.user && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '1rem',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '0.6rem 1.2rem',
            borderRadius: '50px',
            border: '1px solid var(--glass-border)',
            alignSelf: 'flex-end',
            fontSize: '0.85rem'
          }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
              {session.user.email}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
            <button 
              onClick={handleSignOut}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              className="btn-logout"
            >
              <LogOut size={14} />
              <span>로그아웃</span>
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: session?.user ? '0.5rem' : '1.5rem' }}>
          <h1 className="text-gradient brand-title" style={{ fontSize: 'clamp(2.5rem, 8vw, 3.5rem)', marginBottom: '0.5rem' }}>Don't Forget!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>자신만의 단어장을 만들고 스마트하게 학습하세요.</p>
        </div>
      </header>

      {/* 새 세트 만들기 */}
      <section className="card" style={{ marginBottom: '3rem', background: 'rgba(255,255,255,0.02)', padding: '1.2rem' }}>
        <form onSubmit={handleCreateSet} style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <input
            type="text" 
            className="card"
            style={{ flex: '1 1 280px', background: 'var(--bg-color)', color: 'white', padding: '0.8rem 1.2rem', fontSize: '1rem' }}
            placeholder="새로운 단어 세트 이름..."
            value={newSetTitle}
            onChange={(e) => setNewSetTitle(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={creating} style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', whiteSpace: 'nowrap' }}>
            {creating ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> 세트 만들기</>}
          </button>
        </form>
      </section>

      {/* 세트 목록 (그리드 레이아웃 적용) */}
      <div className="sets-grid">
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', gridColumn: '1 / -1' }}>
          <Layers size={22} color="var(--accent-color)" /> 나의 세트 목록
        </h2>
        
        {sets.map((set) => (
          <div key={set.id} className="card dashboard-item" style={{ 
            padding: '1.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem'
          }}>
            {/* [정보 + 관리] 상단 바 */}
            <div style={{ width: '100%' }}>
              {/* 첫 번째 줄: 제목 */}
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.8rem' }}>
                {set.title}
              </h3>
              
              {/* 두 번째 줄: 단어 수 및 관리 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>
                  <BookOpen size={14} color="var(--accent-color)" />
                  <span>{set.cards?.[0]?.count || 0} 단어</span>
                  <span style={{ margin: '0 0.3rem', opacity: 0.3 }}>|</span>
                  <Clock size={14} style={{ opacity: 0.6 }} />
                  <span style={{ opacity: 0.6 }}>{new Date(set.created_at).toLocaleDateString()}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button 
                    onClick={() => navigate(`/set/${set.id}/manage`)}
                    className="btn-hover-icon"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                    title="관리"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteSet(set.id)}
                    className="btn-hover-danger"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* [학습 설정 + 메인 액션] 하단 컨트롤러 */}
            <div className="study-controls">
              {/* 설정 부분 */}
              <div className="setting-group">
                <div className="segment-control">
                  <button onClick={() => updateQuickSetting(set.id, 'direction', 'word')} style={getSegmentStyle(quickSettings[set.id]?.direction === 'word')}>단어 우선</button>
                  <button onClick={() => updateQuickSetting(set.id, 'direction', 'meaning')} style={getSegmentStyle(quickSettings[set.id]?.direction === 'meaning')}>뜻 우선</button>
                </div>
                <div className="segment-control">
                  <button onClick={() => updateQuickSetting(set.id, 'order', 'seq')} style={getSegmentStyle(quickSettings[set.id]?.order === 'seq')}>순차적</button>
                  <button onClick={() => updateQuickSetting(set.id, 'order', 'rand')} style={getSegmentStyle(quickSettings[set.id]?.order === 'rand')}>무작위</button>
                </div>
              </div>

              {/* 실행 버튼 부분 */}
              <div className="action-group">
                <button onClick={() => startStudy(set.id)} className="btn-study">
                  <Play size={18} fill="currentColor" /> <span>학습 시작</span>
                </button>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.2rem 0.5rem' }} />
                <button onClick={() => startTest(set.id)} className="btn-test">
                  <ClipboardList size={18} /> <span>테스트</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {sets.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem' }}>새로운 세트를 만들어 학습 여정을 시작하세요!</p>
        )}
      </div>

      <style>{`
        .sets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
          gap: 1.5rem;
          width: 100%;
        }
        @media (max-width: 850px) {
          .sets-grid { grid-template-columns: 1fr; }
        }

        .dashboard-item { transition: all 0.2s ease-out; height: 100%; display: flex; flex-direction: column; }
        .dashboard-item:hover { transform: translateY(-2px); border-color: rgba(99,102,241,0.3); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
        
        .study-controls { 
          display: flex; flex-direction: column; gap: 1rem;
          background: rgba(0,0,0,0.15); padding: 1rem; border-radius: 12px;
        }
        
        .setting-group { display: flex; gap: 0.8rem; flex-wrap: wrap; }
        .segment-control { display: flex; background: rgba(255,255,255,0.05); padding: 3px; border-radius: 8px; flex: 1 1 140px; }
        .segment-control button { flex: 1; white-space: nowrap; }
        
        .action-group { display: flex; flex-direction: column; gap: 0.6rem; width: 100%; }
        .action-group button { width: 100%; display: flex; alignItems: center; justifyContent: center; gap: 0.5rem; border-radius: 10px; font-weight: 800; cursor: pointer; transition: all 0.2s; white-space: nowrap; padding: 0.8rem 1rem; }
        
        .btn-test { background: rgba(255,255,255,0.06); color: white; border: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; }
        .btn-test:hover { background: rgba(255,255,255,0.12); }
        .btn-test span { color: #cbd5e1; }
        
        .btn-study { background: var(--accent-color); color: white; border: none; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
        .btn-study:hover { background: var(--accent-hover); transform: translateY(-1px); }

        .btn-hover-icon:hover { color: var(--accent-color) !important; }
        .btn-hover-danger:hover { color: var(--danger) !important; background: rgba(244, 63, 94, 0.05) !important; }
        
        .btn-logout:hover {
          color: var(--danger) !important;
          background: rgba(244, 63, 94, 0.08) !important;
        }
      `}</style>
    </div>
  )
}

function getSegmentStyle(active) {
  return {
    padding: '0.4rem 0.6rem',
    fontSize: '0.72rem',
    borderRadius: '6px',
    background: active ? 'var(--accent-color)' : 'transparent',
    color: active ? 'white' : 'rgba(203, 213, 225, 0.6)',
    fontWeight: '800',
    transition: 'all 0.2s',
    border: 'none',
    cursor: 'pointer'
  }
}
