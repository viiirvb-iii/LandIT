import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseConfigured } from '../lib/supabase'
import Passport from './Passport'
import './AppLayout.css'

export default function AppLayout({ children, activeTab }) {
  const [showPassport, setShowPassport] = useState(false)
  const [toast, setToast] = useState(null)
  const [passportData, setPassportData] = useState(null)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Fetch real user data for Passport
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !user) {
      // Fallback for unauthenticated users
      setPassportData({
        name: user?.user_metadata?.full_name || user?.email || 'Traveller',
        country: 'AUSTRALIA',
        from: 'MELB',
        to: 'HIRE',
        flight: 'LD-2026',
        gate: 'G7',
        class: 'Grad',
        season: '2026',
        degree: '',
        university: '',
        year: '',
        resumeUpdated: 'Not uploaded',
        searching: 'Software roles',
        locations: '',
        fields: '',
        swipedToday: 0,
        tailorsLeft: 5,
        stamps: [],
      })
      return
    }

    async function loadPassportData() {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      // Fetch resume status
      const { data: resume } = await supabase
        .from('parsed_resumes')
        .select('parsed_at, skills_extracted, storage_path, parsed_data')
        .eq('user_id', user.id)
        .maybeSingle()

      // Fetch swipe count for today
      const today = new Date().toISOString().split('T')[0]
      const { count: swipeCount } = await supabase
        .from('swipe_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('swiped_at', today)

      // Fetch stamps (application milestones)
      const { data: applications } = await supabase
        .from('applications')
        .select('id, status, job_id, jobs(company)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6)

      const stamps = (applications || []).map(app => ({
        icon: app.status === 'landed' ? '🎉' : app.status === 'applied' ? '✈' : '✦',
        label: `${app.jobs?.company || 'Company'} ${app.status === 'applied' ? 'Applied' : app.status === 'landed' ? 'Landed!' : app.status}`,
        variant: app.status === 'landed' ? 'gold' : 'filled',
      }))

      // Format resume date
      let resumeStatus = 'Not uploaded'
      if (resume?.parsed_at) {
        const d = new Date(resume.parsed_at)
        resumeStatus = `Updated ${d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}`
      }

      // Format locations
      const locations = profile?.preferred_locations || []
      const fields = profile?.preferred_fields || []

      // Extract resume parsed info
      const parsed = resume?.parsed_data || {}
      const contact = parsed.contact || {}
      const experience = parsed.experience || []
      const education = parsed.education || []
      const projects = parsed.projects || []

      setPassportData({
        name: profile?.full_name || contact.name || user.user_metadata?.full_name || user.email,
        email: user.email,
        phone: contact.phone || null,
        location: contact.location || null,
        country: profile?.country || 'AUSTRALIA',
        from: profile?.city_from || 'MELB',
        to: profile?.city_to || 'HIRE',
        flight: 'LD-2026',
        gate: 'G7',
        class: profile?.year || 'Grad',
        season: '2026',
        degree: profile?.degree || '',
        university: profile?.university || '',
        year: profile?.year || '',
        resumeUpdated: resumeStatus,
        resumeSkills: resume?.skills_extracted || [],
        resumePath: resume?.storage_path || null,
        resumeSummary: parsed.summary || null,
        resumeExperience: experience,
        resumeEducation: education,
        resumeProjects: projects,
        careerLevel: parsed.career_level || null,
        searching: profile?.searching_for || 'Software roles',
        locations: locations.length > 0 ? locations.join(', ') : 'Not set',
        fields: fields.length > 0 ? fields.join(', ') : 'Not set',
        swipedToday: swipeCount || 0,
        tailorsLeft: profile?.ai_tailors_remaining ?? 5,
        stamps,
      })
    }

    loadPassportData()
  }, [user, showPassport]) // Reload when passport opens

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  return (
    <div className="app-shell">
      {/* Top nav */}
      <div className="app-topnav">
        <div className="app-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#3b82f6"/>
          </svg>
          Landed
        </div>
        <div className="app-topnav-right">
          <button className="app-passport-btn" onClick={() => setShowPassport(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="2" width="18" height="20" rx="2"/>
              <line x1="8" y1="8" x2="16" y2="8"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="8" y1="16" x2="12" y2="16"/>
            </svg>
            Passport
          </button>
          <button className="app-signout-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="app-content">
        {typeof children === 'function' ? children({ showToast }) : children}
      </div>

      {/* Bottom nav */}
      <div className="app-bnav">
        <button
          className={`app-bnav-item ${activeTab === 'swipe' ? 'active' : ''}`}
          onClick={() => navigate('/app/swipe')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/>
          </svg>
          <span>swipe</span>
        </button>
        <button
          className={`app-bnav-item ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => navigate('/app/review')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>review</span>
        </button>
        <button
          className={`app-bnav-item ${activeTab === 'wishlist' ? 'active' : ''}`}
          onClick={() => navigate('/app/wishlist')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>wishlist</span>
        </button>
      </div>

      {/* Passport overlay */}
      <Passport
        open={showPassport}
        onClose={() => setShowPassport(false)}
        data={passportData}
      />

      {/* Toast */}
      {toast && (
        <div className="app-toast">{toast}</div>
      )}
    </div>
  )
}
