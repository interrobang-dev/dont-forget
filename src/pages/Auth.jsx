import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import bgImage from '../assets/dont-forger-bg.png'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('가입을 환영합니다! 이메일 인증을 확인하거나 바로 로그인해 보세요.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      alert(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="card animate-fade auth-card">
        {/* 카드 자체 배경 이미지 레이어 */}
        <div 
          className="auth-card-bg"
          style={{ backgroundImage: `url(${bgImage})` }} 
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="text-gradient brand-title">Don't Forget!</h1>
          <p className="auth-subtitle">
            망각을 극복하기 위한 나만의 단어장
          </p>
        
        <form onSubmit={handleAuth} className="auth-form">
          <input
            className="auth-input"
            type="email"
            placeholder="이메일 주소"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="비밀번호"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>
        
        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="auth-toggle-btn"
        >
          {isSignUp ? '이미 계정이 있나요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
        </div>
      </div>
    </div>
  )
}
