import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Auth from './pages/Auth'
import './index.css'

import SetDetail from './pages/SetDetail'
import StudyMode from './pages/StudyMode'
import TestMode from './pages/TestMode'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
      로딩 중...
    </div>
  )

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <div className="app-container">
        {/* 다이내믹 백그라운드 글로우 */}
        <div className="bg-glow-container">
          <div className="bg-glow-circle glow-1"></div>
          <div className="bg-glow-circle glow-2"></div>
        </div>
        <Routes>
          <Route 
            path="/" 
            element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/login" 
            element={!session ? <Auth /> : <Navigate to="/" />} 
          />
          <Route 
            path="/set/:id/study" 
            element={session ? <StudyMode /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/set/:id" 
            element={<Navigate to="study" replace />} 
          />
          <Route 
            path="/set/:id/manage" 
            element={session ? <SetDetail /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/set/:id/test" 
            element={session ? <TestMode /> : <Navigate to="/login" />} 
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
