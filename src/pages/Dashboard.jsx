import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = user?.user_metadata?.full_name || user?.email

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-inner">
          <div className="dash-brand">
            <span className="plane-icon">✈</span>
            <span className="auth-brand">Land<span className="brand-accent">It</span></span>
          </div>
          <div className="dash-nav-right">
            <span className="dash-user">Welcome, {displayName}</span>
            <button onClick={handleSignOut} className="dash-signout">Sign Out</button>
          </div>
        </div>
      </nav>

      <main className="dash-main">
        <div className="dash-welcome">
          <div className="dash-welcome-icon">🛫</div>
          <h1>Ready for Takeoff!</h1>
          <p>Your boarding pass is confirmed. The job swipe feed, onboarding, and more features are coming soon.</p>
        </div>

        <div className="dash-cards">
          <div className="dash-card">
            <span className="dash-card-icon">📋</span>
            <h3>Onboarding</h3>
            <p>Set up your profile, upload your resume, and get your passport ready.</p>
            <span className="dash-card-status">Coming Soon</span>
          </div>
          <div className="dash-card">
            <span className="dash-card-icon">💼</span>
            <h3>Job Swipe Feed</h3>
            <p>Swipe through curated job listings matched to your profile.</p>
            <span className="dash-card-status">Coming Soon</span>
          </div>
          <div className="dash-card">
            <span className="dash-card-icon">🧳</span>
            <h3>Baggage Claim</h3>
            <p>Pick up your generated cover letters, resumes, and application notes.</p>
            <span className="dash-card-status">Coming Soon</span>
          </div>
        </div>
      </main>
    </div>
  )
}
