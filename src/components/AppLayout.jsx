import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Passport from './Passport'
import './AppLayout.css'

export default function AppLayout({ children, activeTab }) {
  const [showPassport, setShowPassport] = useState(false)
  const [toast, setToast] = useState(null)
  const [passportData, setPassportData] = useState(null)
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    async function loadPassport() {
      const [{ data: profile }, { data: parsedResume }, { data: stamps }, { count: swipedToday }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single(),
        supabase
          .from('parsed_resumes')
          .select('parsed_data, skills_extracted, raw_text, parsed_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('stamps')
          .select('label, stamp_type')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false })
          .limit(6),
        supabase
          .from('swipe_history')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('swiped_at', new Date().toISOString().slice(0, 10))
          .then(r => r),
      ])

      if (!profile) return

      setPassportData({
        name: profile.full_name || 'Traveller',
        country: profile.country || 'AUSTRALIA',
        from: profile.city_from || 'MELB',
        to: profile.city_to || 'HIRE',
        flight: 'LD-2026',
        gate: 'G7',
        class: profile.searching_for || '—',
        season: '2026',
        degree: profile.degree || '—',
        university: profile.university || '—',
        year: profile.year || '—',
        resumeUpdated: profile.resume_updated_at
          ? `Updated ${new Date(profile.resume_updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
          : 'Not uploaded',
        searching: profile.searching_for || '—',
        locations: profile.preferred_locations?.length ? profile.preferred_locations : ['Not set'],
        fields: profile.preferred_fields?.length ? profile.preferred_fields : ['Not set'],
        swipedToday: swipedToday ?? 0,
        tailorsLeft: profile.ai_tailors_remaining ?? 0,
        stamps: (stamps || []).map(s => ({ label: s.label })),
        resume: parsedResume || null,
      })
    }
    loadPassport()
  }, [user])

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
