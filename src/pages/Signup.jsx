import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseConfigured } from '../lib/supabase'
import './Auth.css'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()           // ← signUp not signIn
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Create auth account + profiles row (AuthContext handles both)
      const { data, error: signUpError } = await signUp(email, password, name)
      if (signUpError) throw signUpError
      if (!data?.user) throw new Error('Signup failed — no user returned')

      // 2. Create users table row
      if (supabaseConfigured && supabase) {
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id:    data.user.id,
            name:  name,
            email: data.user.email,
            fields_of_interest:  [],
            industry_interests:  [],
            skills:              [],
            session_preferences: {
              auto_updates_remaining: 5,
              auto_updates_daily_cap: 5
            },
            passport_data: {
              flight_code: 'LD-2026',
              gate:        'G7',
              seat:        '3A',
              stamps:      []
            }
          })

        if (userError) {
          // Log but don't block — user can still proceed to onboarding
          console.error('Users insert error:', userError.message)
        }
      }

      // 3. Go to onboarding
      navigate('/onboarding')

    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="cloud cloud-1" />
        <div className="cloud cloud-2" />
        <div className="cloud cloud-3" />
        <div className="plane-trail" />
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <span className="plane-icon">✈</span>
            <span className="auth-brand">Land<span className="brand-accent">It</span></span>
          </div>
          <h1>Get Your Boarding Pass</h1>
          <p>Create your account to start your journey</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-wrapper">
              <span className="input-icon">✈</span>
              <input
                id="name"
                type="text"
                placeholder="Alex Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon">✉</span>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <>Issue Boarding Pass <span className="btn-arrow">→</span></>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have a boarding pass? <Link to="/login">Sign in</Link></p>
        </div>

        <div className="auth-ticket-tear" />
      </div>
    </div>
  )
}