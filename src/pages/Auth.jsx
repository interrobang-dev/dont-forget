import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

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
    <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="card animate-fade" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 className="text-gradient" style={{ marginBottom: '1.5rem', fontSize: '2.5rem' }}>까먹지마!</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>나만의 스마트한 단어 기억 도우미</p>
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            className="card"
            style={{ width: '100%', padding: '0.8rem', background: 'var(--glass)', color: 'white' }}
            type="email"
            placeholder="이메일 주소"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="card"
            style={{ width: '100%', padding: '0.8rem', background: 'var(--glass)', color: 'white' }}
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
          style={{ background: 'none', color: 'var(--accent-color)', marginTop: '1.5rem', fontSize: '0.9rem' }}
        >
          {isSignUp ? '이미 계정이 있나요? 로그인' : '계정이 없으신가요? 회원가입'}
        </button>
      </div>
    </div>
  )
}
