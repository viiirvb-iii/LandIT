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
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Create auth account — AuthContext also handles the initial profiles upsert
      const { data, error: signUpError } = await signUp(email, password, name)
      if (signUpError) throw signUpError
      if (!data?.user) throw new Error('Signup failed — no user returned')

      // 2. Update profiles with all initial fields
      if (supabaseConfigured && supabase) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name:           name,
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
          .eq('id', data.user.id)

        if (profileError) {
          // Non-fatal — log and continue to onboarding
          console.error('Profile update error:', profileError.message)
        }
      }

      // 3. Go to onboarding to collect degree, skills, industry
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