import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Play, Edit2, Clock, Layers, Loader2, ClipboardList, BookOpen, LogOut, Search, Globe, Lock, CheckCircle2, MoreVertical, Settings } from 'lucide-react'

export default function Dashboard({ session }) {
  const [sets, setSets] = useState([])
  const [newSetTitle, setNewSetTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [quickSettings, setQuickSettings] = useState({}) 
  
  // UX 개선을 위한 상태 선언
  const [activeDropdownId, setActiveDropdownId] = useState(null)
  const [showSettingsMap, setShowSettingsMap] = useState({})
  
  // Together 공유 모드 관련 상태 변수 (내부 제어명은 'private' / 'public' 표준 명칭 사용)
  const [activeMode, setActiveMode] = useState('private') 
  const [sharedSets, setSharedSets] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cloningSetId, setCloningSetId] = useState(null)
  const [searching, setSearching] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSetIsPublic, setNewSetIsPublic] = useState(false)

  const navigate = useNavigate()

  // 드롭다운 바깥 영역 클릭 시 닫기 핸들러
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownId(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

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

  // Together 모드에서 검색창 입력 시 실시간 비동기 검색 트리거
  useEffect(() => {
    if (activeMode === 'public') {
      fetchSharedSets()
    }
  }, [searchQuery, activeMode])

  const fetchSets = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('word_sets')
        .select(`*, cards(id, is_memorized)`)
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setSets(data || [])
      
      const initialSettings = {}
      data.forEach(s => {
        initialSettings[s.id] = { 
          direction: s.study_direction || 'word', 
          order: s.study_order || 'seq',
          wordSize: s.word_size || 'medium',
          meaningSize: s.meaning_size || 'medium',
          excludeMemorized: s.exclude_memorized !== undefined ? s.exclude_memorized : false
        }
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
        .insert([{ 
          title: newSetTitle, 
          user_id: userData.user.id,
          is_public: newSetIsPublic
        }])
        .select()
      if (error) throw error
      setSets([{ ...data[0], cards: [] }, ...sets])
      setQuickSettings({ 
        ...quickSettings, 
        [data[0].id]: { 
          direction: 'word', 
          order: 'seq', 
          wordSize: 'medium', 
          meaningSize: 'medium', 
          excludeMemorized: false 
        } 
      })
      setNewSetTitle('')
      setNewSetIsPublic(false)
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
    // 1. UI 상태 즉각 변경 (Optimistic Update)
    setQuickSettings(prev => ({
      ...prev,
      [setId]: { ...prev[setId], [key]: value }
    }))

    const isOwner = sets.some(s => s.id === setId)

    // 타인 세트인 경우 localStorage에 학습/테스트 양대 설정 백업 영속화
    if (!isOwner) {
      // 1) 학습 설정 캐싱
      const savedStudy = localStorage.getItem('quick_study_settings')
      const studyAll = savedStudy ? JSON.parse(savedStudy) : {}
      studyAll[setId] = { 
        ...studyAll[setId], 
        [key]: value 
      }
      localStorage.setItem('quick_study_settings', JSON.stringify(studyAll))

      // 2) 테스트 설정 캐싱
      const savedTest = localStorage.getItem('quick_test_settings')
      const testAll = savedTest ? JSON.parse(savedTest) : {}
      
      const testKey = key === 'order' ? 'isRandom' : key
      const testValue = key === 'order' ? (value === 'rand') : value
      
      testAll[setId] = { 
        ...testAll[setId], 
        [testKey]: testValue 
      }
      localStorage.setItem('quick_test_settings', JSON.stringify(testAll))
    }

    // 2. 소유주인 경우에만 Supabase DB에 실시간 저장 연동
    if (isOwner) {
      const dbFieldMap = {
        direction: 'study_direction',
        order: 'study_order',
        wordSize: 'word_size',
        meaningSize: 'meaning_size',
        excludeMemorized: 'exclude_memorized'
      }
      const dbField = dbFieldMap[key]
      if (dbField) {
        supabase
          .from('word_sets')
          .update({ [dbField]: value })
          .eq('id', setId)
          .then(({ error }) => {
            if (error) console.error('설정 저장 실패:', error.message)
          })
      }
    }
  }

  const toggleSettings = (setId) => {
    setShowSettingsMap(prev => ({
      ...prev,
      [setId]: !prev[setId]
    }))
  }

  const startStudy = (setId) => {
    // 소유주인 경우에만 Supabase Cloud DB에 최근 학습일 실시간 기록
    const isOwner = sets.some(s => s.id === setId)
    if (isOwner) {
      supabase
        .from('word_sets')
        .update({ last_studied_at: new Date().toISOString() })
        .eq('id', setId)
        .then(({ error }) => {
          if (error) console.error('학습 이력 Supabase 저장 실패:', error.message)
        })
    }

    // 2. 예비용 로컬 스토리지 적재
    localStorage.setItem(`last_study_${setId}`, new Date().toISOString())
    navigate(`/set/${setId}/study`)
  }

  const startTest = (setId) => {
    // 소유주인 경우에만 Supabase Cloud DB에 최근 학습일 실시간 기록
    const isOwner = sets.some(s => s.id === setId)
    if (isOwner) {
      supabase
        .from('word_sets')
        .update({ last_studied_at: new Date().toISOString() })
        .eq('id', setId)
        .then(({ error }) => {
          if (error) console.error('학습 이력 Supabase 저장 실패:', error.message)
        })
    }

    // 2. 예비용 로컬 스토리지 적재
    localStorage.setItem(`last_study_${setId}`, new Date().toISOString())
    navigate(`/set/${setId}/test`)
  }

  // 타인이 공개한 세트 목록 불러오기 (검색어 포함)
  const fetchSharedSets = async (queryStr = searchQuery) => {
    setSearching(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      let query = supabase
        .from('word_sets')
        .select('*, cards(count)')
        .eq('is_public', true)
        .neq('user_id', userData.user.id)
      
      if (queryStr.trim()) {
        query = query.ilike('title', `%${queryStr}%`)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      setSharedSets(data || [])

      // 타인 공유 세트들의 quickSettings 임시 초기화 적용 (localStorage 백업 반영)
      const updatedSettings = { ...quickSettings }
      const savedStudyAll = localStorage.getItem('quick_study_settings')
      const studyAll = savedStudyAll ? JSON.parse(savedStudyAll) : {}

      if (data) {
        data.forEach(s => {
          if (!updatedSettings[s.id]) {
            const localStudy = studyAll[s.id] || {}
            updatedSettings[s.id] = { 
              direction: localStudy.direction || s.study_direction || 'word', 
              order: localStudy.order || s.study_order || 'seq',
              wordSize: localStudy.wordSize || s.word_size || 'medium',
              meaningSize: localStudy.meaningSize || s.meaning_size || 'medium',
              excludeMemorized: false
            }
          }
        })
      }
      setQuickSettings(updatedSettings)
    } catch (error) {
      console.error('공유 세트 로드 실패:', error.message)
    } finally {
      setSearching(false)
    }
  }

  // 타인의 공개 세트를 내 단어 세트로 복사 (벌크 인서트 연산)
  const handleCloneSet = async (sharedSet) => {
    if (cloningSetId) return
    if (!confirm(`'${sharedSet.title}' 세트를 가져와 내 세트로 등록하겠습니까?`)) return
    
    setCloningSetId(sharedSet.id)
    try {
      const { data: userData } = await supabase.auth.getUser()
      
      // 1. 내 단어 세트 신규 생성 (원본 제목 그대로 사용)
      const { data: newSet, error: newSetError } = await supabase
        .from('word_sets')
        .insert([{
          title: sharedSet.title,
          description: sharedSet.description,
          user_id: userData.user.id,
          is_public: false // 가져올 때는 기본적으로 비공개 상태로 시작
        }])
        .select()
        .single()

      if (newSetError) throw newSetError

      // 2. 공유 세트에 종속된 모든 카드 목록 조회
      const { data: originalCards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', sharedSet.id)

      if (cardsError) throw cardsError

      // 3. 카드 벌크 복사 삽입
      if (originalCards && originalCards.length > 0) {
        const cardsToInsert = originalCards.map(card => ({
          set_id: newSet.id,
          word: card.word,
          meaning: card.meaning,
          image_url: card.image_url,
          is_memorized: false,
          display_order: card.display_order
        }))

        const { error: insertError } = await supabase
          .from('cards')
          .insert(cardsToInsert)

        if (insertError) throw insertError
      }

      alert('세트를 성공적으로 내 목록으로 복사해왔습니다!')
      
      fetchSets()
      setActiveMode('private')
    } catch (error) {
      alert('세트 복사 중 에러가 발생했습니다: ' + error.message)
    } finally {
      setCloningSetId(null)
    }
  }

  if (loading) return <div className="container" style={{ textAlign: 'center', padding: '5rem' }}>로딩 중...</div>

  return (
    <div className="container" style={{ maxWidth: '1000px' }}>
      <header style={{ 
        marginBottom: '3rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '1.5rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', userSelect: 'none' }}>
          <h1 className="brand-title" style={{ 
            fontSize: 'clamp(2.2rem, 7vw, 3.2rem)', 
            marginBottom: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            lineHeight: 1
          }}>
            {/* Don't Forget (나의 단어장 활성화 영역) */}
            <span 
              onClick={() => {
                if (activeMode === 'public') {
                  setActiveMode('private')
                }
              }}
              className="text-gradient"
              style={{ 
                cursor: activeMode === 'public' ? 'pointer' : 'default',
                color: activeMode === 'private' ? 'var(--text-primary)' : 'var(--text-secondary)',
                opacity: activeMode === 'private' ? 1 : 0.4,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              Don't Forget
            </span>

            {/* Together (공유 모드 활성화 영역 - 전구 켜고 끄는 연출) */}
            <span 
              onClick={() => {
                if (activeMode === 'private') {
                  setActiveMode('public')
                  fetchSharedSets()
                }
              }}
              className={activeMode === 'public' ? "text-gradient" : ""}
              style={{ 
                cursor: activeMode === 'private' ? 'pointer' : 'default',
                color: activeMode === 'public' ? 'var(--accent-color)' : 'var(--text-secondary)',
                opacity: activeMode === 'public' ? 1 : 0.18,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textShadow: activeMode === 'public' ? '0 0 15px rgba(153, 27, 27, 0.6)' : 'none'
              }}
            >
              Together
            </span>
          </h1>
        </div>

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
      </header>

      {activeMode === 'private' ? (
        <>
          {/* 나의 단어장 모드 */}
          {/* 세트 목록 (그리드 레이아웃 적용) */}
          <div className="sets-grid">
            <h2 style={{ fontSize: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', gridColumn: '1 / -1' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Layers size={22} color="var(--accent-color)" /> 나의 세트 목록
              </span>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
                style={{ 
                  padding: '0.5rem 1rem', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <Plus size={16} /> 세트 추가
              </button>
            </h2>
            
            {sets.map((set) => (
              <div key={set.id} className="card dashboard-item" style={{ 
                padding: '1.5rem',
                background: 'var(--card-bg)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem',
                position: 'relative'
              }}>
                {/* [정보 + 관리] 상단 바 */}
                <div style={{ width: '100%' }}>
                  {/* 첫 번째 줄: 제목(아이콘 포함) + 더보기 메뉴 배치 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.6rem', position: 'relative' }}>
                    <h3 
                      style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: '800', 
                        margin: 0,
                        flex: 1,
                        minWidth: 0,
                        maxWidth: '78%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                      title={set.title}
                    >
                      {set.is_public ? (
                        <Globe size={16} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                      ) : (
                        <Lock size={16} color="var(--text-secondary)" style={{ flexShrink: 0, opacity: 0.7 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {set.title}
                      </span>
                    </h3>
                    
                    {/* 더보기 (⋮) 관리 메뉴 버튼 */}
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveDropdownId(activeDropdownId === set.id ? null : set.id)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '0.3rem',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        className="btn-hover-icon"
                        title="더보기"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {/* 드롭다운 메뉴 (수정/삭제) */}
                      <AnimatePresence>
                        {activeDropdownId === set.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '0.5rem',
                              background: 'rgba(30, 27, 27, 0.96)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '8px',
                              padding: '0.4rem 0',
                              zIndex: 100,
                              minWidth: '110px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                              backdropFilter: 'blur(12px)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => {
                                setActiveDropdownId(null)
                                navigate(`/set/${set.id}/manage`)
                              }}
                              style={{
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-primary)',
                                padding: '0.6rem 1rem',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'background 0.2s'
                              }}
                              className="btn-hover-icon"
                            >
                              <Edit2 size={14} /> 수정하기
                            </button>
                            <button 
                              onClick={() => {
                                setActiveDropdownId(null)
                                handleDeleteSet(set.id)
                              }}
                              style={{
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                color: 'var(--danger)',
                                padding: '0.6rem 1rem',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'background 0.2s'
                              }}
                              className="btn-hover-danger"
                            >
                              <Trash2 size={14} /> 삭제하기
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  {/* 두 번째 줄: 단어 수 및 암기완료 수 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: '600', flexWrap: 'wrap' }}>
                    <Layers size={13} style={{ opacity: 0.6 }} />
                    <span>총 {set.cards ? set.cards.length : 0}개</span>
                    
                    <span style={{ margin: '0 0.1rem', opacity: 0.25 }}>|</span>
                    
                    <CheckCircle2 size={13} color="var(--success)" />
                    <span style={{ color: 'var(--success)' }}>암기 완료 {set.cards ? set.cards.filter(c => c.is_memorized).length : 0}개</span>
                  </div>

                  {/* 세 번째 줄: 암기율 프로그레스 바 */}
                  {(() => {
                    const total = set.cards ? set.cards.length : 0
                    const memorized = set.cards ? set.cards.filter(c => c.is_memorized).length : 0
                    const percentage = total > 0 ? Math.round((memorized / total) * 100) : 0
                    
                    return (
                      <div style={{ marginTop: '0.6rem', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                          <span style={{ opacity: 0.7 }}>암기 달성도</span>
                          <span style={{ color: percentage === 100 ? 'var(--success)' : 'var(--text-primary)', fontWeight: '700' }}>{percentage}%</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${percentage}%`, 
                              height: '100%', 
                              background: percentage === 100 
                                ? 'linear-gradient(90deg, #10b981, #059669)' 
                                : 'linear-gradient(90deg, var(--accent-color), #f43f5e)', 
                              borderRadius: '10px',
                              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
                            }} 
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* [학습 설정 + 메인 액션] 하단 컨트롤러 */}
                <div className="study-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                   {/* 1. 학습/테스트 설정 토글 바 */}
                   <button 
                     onClick={(e) => {
                       e.stopPropagation()
                       toggleSettings(set.id)
                     }}
                     className="settings-toggle-btn"
                     style={{
                       width: '100%',
                       background: showSettingsMap[set.id] ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                       border: showSettingsMap[set.id] ? '1px solid rgba(255,255,255,0.18)' : '1px solid var(--glass-border)',
                       color: showSettingsMap[set.id] ? 'var(--text-primary)' : 'var(--text-secondary)',
                       padding: '0.6rem 1rem',
                       borderRadius: '10px',
                       cursor: 'pointer',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'space-between',
                       transition: 'all 0.25s ease',
                       fontFamily: 'inherit',
                       fontSize: '0.8rem',
                       fontWeight: 'bold'
                     }}
                    title="학습 및 테스트 진행 방식 옵션을 설정합니다"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Settings 
                        size={16} 
                        style={{ 
                          transition: 'transform 0.4s ease',
                          transform: showSettingsMap[set.id] ? 'rotate(90deg)' : 'rotate(0deg)'
                        }} 
                      />
                      <span>학습 / 테스트 진행 방식 설정</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                      {showSettingsMap[set.id] ? '접기 ▲' : '펼치기 ▼'}
                    </span>
                  </button>

                  {/* 세그먼트 옵션 슬라이드 다운 */}
                  <AnimatePresence initial={false}>
                    {showSettingsMap[set.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden', width: '100%' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.18)', padding: '0.6rem 0.8rem', borderRadius: '10px', marginTop: '0.2rem' }}>
                          {/* 1. 대상 단어 범위 - 소유주인 경우에만 노출 */}
                          {sets.some(s => s.id === set.id) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>대상 단어 범위</span>
                              <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                                <button onClick={() => updateQuickSetting(set.id, 'excludeMemorized', false)} style={getSegmentStyle(quickSettings[set.id]?.excludeMemorized === false)}>전체</button>
                                <button onClick={() => updateQuickSetting(set.id, 'excludeMemorized', true)} style={getSegmentStyle(quickSettings[set.id]?.excludeMemorized === true)}>암기 제외</button>
                              </div>
                            </div>
                          )}

                          {/* 2. 카드 방향 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>카드 방향</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'direction', 'word')} style={getSegmentStyle(quickSettings[set.id]?.direction === 'word')}>단어 우선</button>
                              <button onClick={() => updateQuickSetting(set.id, 'direction', 'meaning')} style={getSegmentStyle(quickSettings[set.id]?.direction === 'meaning')}>뜻 우선</button>
                            </div>
                          </div>

                          {/* 3. 진행 순서 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>진행 순서</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'order', 'seq')} style={getSegmentStyle(quickSettings[set.id]?.order === 'seq')}>순차적</button>
                              <button onClick={() => updateQuickSetting(set.id, 'order', 'rand')} style={getSegmentStyle(quickSettings[set.id]?.order === 'rand')}>무작위</button>
                            </div>
                          </div>

                          {/* 4. 단어 텍스트 크기 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>단어 텍스트 크기</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'wordSize', 'small')} style={getSegmentStyle(quickSettings[set.id]?.wordSize === 'small')}>작게</button>
                              <button onClick={() => updateQuickSetting(set.id, 'wordSize', 'medium')} style={getSegmentStyle(quickSettings[set.id]?.wordSize === 'medium')}>보통</button>
                              <button onClick={() => updateQuickSetting(set.id, 'wordSize', 'large')} style={getSegmentStyle(quickSettings[set.id]?.wordSize === 'large')}>크게</button>
                            </div>
                          </div>

                          {/* 5. 뜻 텍스트 크기 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>뜻 텍스트 크기</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'meaningSize', 'small')} style={getSegmentStyle(quickSettings[set.id]?.meaningSize === 'small')}>작게</button>
                              <button onClick={() => updateQuickSetting(set.id, 'meaningSize', 'medium')} style={getSegmentStyle(quickSettings[set.id]?.meaningSize === 'medium')}>보통</button>
                              <button onClick={() => updateQuickSetting(set.id, 'meaningSize', 'large')} style={getSegmentStyle(quickSettings[set.id]?.meaningSize === 'large')}>크게</button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 2. 학습 시작 버튼 (100% 가득 참) */}
                  <button 
                    onClick={() => startStudy(set.id)} 
                    className="btn-study"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '0.8rem 1.2rem',
                      fontFamily: 'inherit'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Play size={16} fill="currentColor" />
                      <span>학습 시작</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', opacity: 0.65, fontWeight: 'normal', fontFamily: 'inherit' }}>
                      {(() => {
                        const lastStudy = set.last_studied_at || localStorage.getItem(`last_study_${set.id}`)
                        return lastStudy ? `최근: ${new Date(lastStudy).toLocaleDateString()}` : '학습 이력 없음'
                      })()}
                    </span>
                  </button>

                  {/* 3. 테스트 버튼 (100% 가득 참) */}
                  <button 
                    onClick={() => startTest(set.id)} 
                    className="btn-test"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '0.8rem 1.2rem',
                      fontFamily: 'inherit'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ClipboardList size={18} /> 
                      <span>테스트</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', opacity: 0.6, fontWeight: 'normal', fontFamily: 'inherit' }}>
                      {(() => {
                        if (set.last_test_date) {
                          return `최근: ${new Date(set.last_test_date).toLocaleDateString()} (${set.last_test_score}/${set.last_test_total})`
                        }
                        const lastTestStr = localStorage.getItem(`last_test_${set.id}`)
                        if (lastTestStr) {
                          try {
                            const lastTest = JSON.parse(lastTestStr)
                            return `최근: ${new Date(lastTest.date).toLocaleDateString()} (${lastTest.score}/${lastTest.total})`
                          } catch (e) {}
                        }
                        return '테스트 이력 없음'
                      })()}
                    </span>
                  </button>
                </div>
              </div>
            ))}
            {sets.length === 0 && !loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem', gridColumn: '1 / -1' }}>새로운 세트를 만들어 학습 여정을 시작하세요!</p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Don't Forget Together 공유 모드 */}
          <div className="sets-grid">
            {/* 1. 타이틀 최상단 배치 */}
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', gridColumn: '1 / -1' }}>
              <Layers size={22} color="var(--accent-color)" /> 다른 사람들이 만든 세트
            </h2>
            
            {/* 2. 타이틀 아래 검색 창 배치 (검색 버튼 없이 실시간 구동) */}
            <div style={{ gridColumn: '1 / -1', marginBottom: '1.5rem', position: 'relative' }}>
              <input
                type="text" 
                style={{ 
                  width: '100%', 
                  background: 'var(--bg-color)', 
                  color: 'white', 
                  padding: '0.8rem 2.8rem 0.8rem 1.2rem', 
                  fontSize: '1rem',
                  border: '2px solid var(--glass-border)',
                  borderRadius: '8px'
                }}
                placeholder="공유된 다른 세트 이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
            
            {/* 3. 공유 세트 카드 그리드 (나의 세트 UI와 완벽한 대칭 유지) */}
            {sharedSets.map((set) => (
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
                  {/* 첫 번째 줄: 제목 및 가져오기 버튼 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 0, flex: 1, minWidth: 0 }}>
                      {set.title}
                    </h3>
                    
                    {/* 편집/삭제 대신 내 단어장으로 가져오기 버튼 배치 */}
                    <div style={{ display: 'flex', flexShrink: 0 }}>
                      <button 
                        onClick={() => handleCloneSet(set)}
                        disabled={cloningSetId === set.id}
                        style={{ 
                          background: 'rgba(99, 102, 241, 0.12)', 
                          border: '1px solid rgba(99, 102, 241, 0.35)', 
                          color: 'var(--accent-color)', 
                          padding: '0.45rem 0.8rem', 
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.78rem',
                          fontWeight: '800',
                          fontFamily: 'inherit',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 6px rgba(99, 102, 241, 0.1)'
                        }}
                        className="btn-hover-accent"
                        title="이 공유 세트를 내 단어장 목록으로 복제합니다"
                      >
                        {cloningSetId === set.id ? (
                          <>
                            <Loader2 className="animate-spin" size={13} />
                            <span>가져오는 중...</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            <span>세트 가져오기</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* 두 번째 줄: 단어 수 및 등록 일자 메타 데이터 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', flexWrap: 'wrap' }}>
                    <BookOpen size={14} color="var(--accent-color)" />
                    <span>{set.cards?.[0]?.count || 0} 단어</span>
                    <span style={{ margin: '0 0.3rem', opacity: 0.3 }}>|</span>
                    <Clock size={14} style={{ opacity: 0.6 }} />
                    <span style={{ opacity: 0.6 }}>{new Date(set.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* [학습 설정 + 메인 액션] 하단 컨트롤러 (공유 카드에도 동일 제공) */}
                <div className="study-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                   {/* 1. 학습/테스트 설정 토글 바 */}
                   <button 
                     onClick={(e) => {
                       e.stopPropagation()
                       toggleSettings(set.id)
                     }}
                     className="settings-toggle-btn"
                     style={{
                       width: '100%',
                       background: showSettingsMap[set.id] ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                       border: showSettingsMap[set.id] ? '1px solid rgba(255,255,255,0.18)' : '1px solid var(--glass-border)',
                       color: showSettingsMap[set.id] ? 'var(--text-primary)' : 'var(--text-secondary)',
                       padding: '0.6rem 1rem',
                       borderRadius: '10px',
                       cursor: 'pointer',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'space-between',
                       transition: 'all 0.25s ease',
                       fontFamily: 'inherit',
                       fontSize: '0.8rem',
                       fontWeight: 'bold'
                     }}
                    title="학습 및 테스트 진행 방식 옵션을 설정합니다"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Settings 
                        size={16} 
                        style={{ 
                          transition: 'transform 0.4s ease',
                          transform: showSettingsMap[set.id] ? 'rotate(90deg)' : 'rotate(0deg)'
                        }} 
                      />
                      <span>학습 / 테스트 진행 방식 설정</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                      {showSettingsMap[set.id] ? '접기 ▲' : '펼치기 ▼'}
                    </span>
                  </button>

                  {/* 세그먼트 옵션 슬라이드 다운 */}
                  <AnimatePresence initial={false}>
                    {showSettingsMap[set.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden', width: '100%' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.18)', padding: '0.6rem 0.8rem', borderRadius: '10px', marginTop: '0.2rem' }}>
                          {/* 1. 대상 단어 범위 - 소유주인 경우에만 노출 */}
                          {sets.some(s => s.id === set.id) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>대상 단어 범위</span>
                              <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                                <button onClick={() => updateQuickSetting(set.id, 'excludeMemorized', false)} style={getSegmentStyle(quickSettings[set.id]?.excludeMemorized === false)}>전체</button>
                                <button onClick={() => updateQuickSetting(set.id, 'excludeMemorized', true)} style={getSegmentStyle(quickSettings[set.id]?.excludeMemorized === true)}>암기 제외</button>
                              </div>
                            </div>
                          )}

                          {/* 2. 카드 방향 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>카드 방향</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'direction', 'word')} style={getSegmentStyle(quickSettings[set.id]?.direction === 'word')}>단어 우선</button>
                              <button onClick={() => updateQuickSetting(set.id, 'direction', 'meaning')} style={getSegmentStyle(quickSettings[set.id]?.direction === 'meaning')}>뜻 우선</button>
                            </div>
                          </div>

                          {/* 3. 진행 순서 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>진행 순서</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'order', 'seq')} style={getSegmentStyle(quickSettings[set.id]?.order === 'seq')}>순차적</button>
                              <button onClick={() => updateQuickSetting(set.id, 'order', 'rand')} style={getSegmentStyle(quickSettings[set.id]?.order === 'rand')}>무작위</button>
                            </div>
                          </div>

                          {/* 4. 단어 텍스트 크기 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>단어 텍스트 크기</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'wordSize', 'small')} style={getSegmentStyle(quickSettings[set.id]?.wordSize === 'small')}>작게</button>
                              <button onClick={() => updateQuickSetting(set.id, 'wordSize', 'medium')} style={getSegmentStyle(quickSettings[set.id]?.wordSize === 'medium')}>보통</button>
                              <button onClick={() => updateQuickSetting(set.id, 'wordSize', 'large')} style={getSegmentStyle(quickSettings[set.id]?.wordSize === 'large')}>크게</button>
                            </div>
                          </div>

                          {/* 5. 뜻 텍스트 크기 */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '26px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 'bold', whiteSpace: 'nowrap', width: '105px', display: 'inline-block', flexShrink: 0 }}>뜻 텍스트 크기</span>
                            <div className="segment-control" style={{ display: 'flex', width: '100%', maxWidth: '160px', flexShrink: 1, height: '100%', padding: '2px', boxSizing: 'border-box', alignItems: 'stretch' }}>
                              <button onClick={() => updateQuickSetting(set.id, 'meaningSize', 'small')} style={getSegmentStyle(quickSettings[set.id]?.meaningSize === 'small')}>작게</button>
                              <button onClick={() => updateQuickSetting(set.id, 'meaningSize', 'medium')} style={getSegmentStyle(quickSettings[set.id]?.meaningSize === 'medium')}>보통</button>
                              <button onClick={() => updateQuickSetting(set.id, 'meaningSize', 'large')} style={getSegmentStyle(quickSettings[set.id]?.meaningSize === 'large')}>크게</button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 2. 학습 시작 버튼 (100% 가득 참) */}
                  <button 
                    onClick={() => startStudy(set.id)} 
                    className="btn-study"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, var(--accent-color), #4f46e5)',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.2rem',
                      borderRadius: '10px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <Play size={16} fill="currentColor" /> <span>학습 시작</span>
                  </button>
                  
                  {/* 3. 테스트 버튼 */}
                  <button 
                    onClick={() => startTest(set.id)} 
                    className="btn-test"
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'white',
                      border: '1px solid var(--glass-border)',
                      padding: '0.75rem 1.2rem',
                      borderRadius: '10px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <ClipboardList size={16} /> <span>테스트 시작</span>
                  </button>
                </div>
              </div>
            ))}
            
            {sharedSets.length === 0 && !searching && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '5rem', gridColumn: '1 / -1' }}>공유된 단어 세트가 존재하지 않습니다.</p>
            )}

            {searching && (
              <div style={{ textAlign: 'center', padding: '5rem', gridColumn: '1 / -1' }}>
                <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--accent-color)' }} />
              </div>
            )}
          </div>
        </>
      )}

      {/* 새로운 단어 세트 생성 모달 (다크 고딕 양식 테마) */}
      <AnimatePresence>
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="card"
              style={{
                width: '90%',
                maxWidth: '450px',
                padding: '2rem',
                background: 'var(--card-bg)',
                border: '2px solid var(--glass-border)',
                boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
                position: 'relative'
              }}
            >
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>새로운 단어 세트 만들기</h3>
              
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!newSetTitle.trim()) return
                await handleCreateSet(e)
                setShowCreateModal(false)
              }}>
                <input
                  type="text" 
                  style={{ 
                    width: '100%', 
                    background: 'var(--bg-color)', 
                    color: 'white', 
                    padding: '0.8rem 1.2rem', 
                    fontSize: '1rem',
                    border: '2px solid var(--glass-border)',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                  }}
                  placeholder="세트 제목 입력..."
                  value={newSetTitle}
                  onChange={(e) => setNewSetTitle(e.target.value)}
                  autoFocus
                />

                {/* 공개 여부 설정 세그먼트 컨트롤 */}
                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '700' }}>공개 설정</span>
                  <div className="segment-control" style={{ maxWidth: '160px', flex: '1' }}>
                    <button 
                      type="button" 
                      onClick={() => setNewSetIsPublic(false)} 
                      style={getSegmentStyle(!newSetIsPublic)}
                    >
                      비공개
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewSetIsPublic(true)} 
                      style={getSegmentStyle(newSetIsPublic)}
                    >
                      공개
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewSetTitle('')
                      setNewSetIsPublic(false)
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-secondary)',
                      padding: '0.6rem 1.2rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      fontFamily: 'inherit'
                    }}
                  >
                    취소
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={creating}
                    style={{
                      padding: '0.6rem 1.2rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontFamily: 'inherit'
                    }}
                  >
                    {creating ? <Loader2 className="animate-spin" size={16} /> : '만들기'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .sets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
          gap: 1.5rem;
          width: 100%;
        }
        @media (max-width: 850px) {
          .sets-grid { grid-template-columns: 1fr; }
          .study-controls { padding: 0 !important; background: transparent !important; }
        }
        @media (max-width: 600px) {
          .container { padding: 0.8rem !important; }
          .dashboard-item { padding: 1rem !important; }
        }
        @media (max-width: 480px) {
          .btn-study, .btn-test {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.25rem !important;
            padding: 0.6rem 0.8rem !important;
          }
          .btn-study > div, .btn-test > div {
            width: 100%;
          }
          .btn-study span, .btn-test span {
            font-size: 0.72rem !important;
          }
          .settings-toggle-btn {
            padding: 0.5rem 0.6rem !important;
          }
          .settings-toggle-btn span {
            font-size: 0.72rem !important;
          }
          .segment-control button {
            font-size: 0.62rem !important;
            padding: 0 0.2rem !important;
          }
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
    height: '100%',
    padding: '0 0.3rem',
    fontSize: '0.68rem',
    borderRadius: '5px',
    background: active ? 'var(--accent-color)' : 'transparent',
    color: active ? 'white' : 'rgba(203, 213, 225, 0.6)',
    fontWeight: '800',
    transition: 'all 0.2s',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap'
  }
}
