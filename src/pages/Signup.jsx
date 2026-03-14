import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await signUp(email, password, fullName)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-bg">
          <div className="cloud cloud-1" />
          <div className="cloud cloud-2" />
          <div className="cloud cloud-3" />
        </div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="success-icon">✈</div>
            <h1>Boarding Pass Issued!</h1>
            <p>Check your email to confirm your account, then you're ready for takeoff.</p>
          </div>
          <Link to="/login" className="auth-btn" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
            Go to Login <span className="btn-arrow">→</span>
          </Link>
          <div className="auth-ticket-tear" />
        </div>
      </div>
    )
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
          <p>Create an account to start your career journey</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="fullName">Full Name</label>
            <div className="input-wrapper">
              <input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-wrapper">
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
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
