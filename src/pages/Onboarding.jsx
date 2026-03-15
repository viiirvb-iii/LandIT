import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { uploadAndParseResume } from '../services/resume'
import './Onboarding.css'

const STEPS = ['basics', 'background', 'resume', 'preferences']

const LOCATION_OPTIONS = [
  'Melbourne CBD', 'Richmond', 'Cremorne', 'Southbank', 'Docklands',
  'Collingwood', 'Sydney', 'Brisbane', 'Remote', 'Hybrid',
]

const ROLE_OPTIONS = [
  'Frontend Developer', 'Backend Developer', 'Full-Stack Developer',
  'DevOps Engineer', 'Cloud Engineer', 'Data Engineer',
  'Mobile Developer', 'Software Engineer', 'SRE',
  'Machine Learning Engineer', 'Product Manager', 'UX Designer',
]

const DEGREE_OPTIONS = [
  'Computer Science', 'Software Engineering', 'Information Technology',
  'Data Science', 'Electrical Engineering', 'Mechanical Engineering',
  'Mathematics', 'Physics', 'Business / Commerce', 'Design',
  'Bootcamp / Self-taught', 'Other',
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef(null)

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [saving, setSaving] = useState(false)
  const [parseStatus, setParseStatus] = useState('') // '' | 'parsing' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  // Form state
  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [email] = useState(user?.email || '')
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [background, setBackground] = useState('')
  const [degree, setDegree] = useState('')
  const [university, setUniversity] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [resume, setResume] = useState(null)
  const [resumeName, setResumeName] = useState('')
  const [skipResume, setSkipResume] = useState(false)
  const [locations, setLocations] = useState([])
  const [dreamRoles, setDreamRoles] = useState([])

  const currentStep = STEPS[step]

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setDirection(1)
      setStep(s => s + 1)
    }
  }
  const goBack = () => {
    if (step > 0) {
      setDirection(-1)
      setStep(s => s - 1)
    }
  }

  const toggleChip = (value, list, setter) => {
    setter(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatar(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleResumeChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResume(file)
    setResumeName(file.name)
    setSkipResume(false)
  }

  const handleFinish = async () => {
    if (!supabaseConfigured || !supabase || !user) {
      navigate(skipResume ? '/app/wishlist' : '/app/swipe')
      return
    }

    setSaving(true)
    setErrorMsg('')

    try {
      // 1. Save profile data to Supabase (upsert in case trigger didn't fire)
      const profileData = {
        id: user.id,
        full_name: name.trim(),
        degree,
        university: university.trim(),
        year: yearLevel,
        preferred_locations: locations,
        preferred_fields: dreamRoles,
        searching_for: `${yearLevel || 'Graduate'} roles`,
      }

      console.log('Saving profile for user:', user.id, profileData)

      const { data: profileResult, error: profileErr } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select()

      console.log('Profile save result:', profileResult, 'error:', profileErr)

      if (profileErr) {
        console.error('Profile save failed:', profileErr)
        setErrorMsg(`Profile save failed: ${profileErr.message}`)
      }

      // 2. Upload avatar if provided
      if (avatar) {
        const ext = avatar.name.split('.').pop()?.toLowerCase() || 'jpg'
        const { error: avatarErr } = await supabase.storage
          .from('avatars')
          .upload(`${user.id}/avatar.${ext}`, avatar, { upsert: true })
        if (avatarErr) {
          console.error('Avatar upload failed:', avatarErr)
        }
      }

      // 3. Upload and parse resume through the RAG pipeline
      if (resume && !skipResume) {
        setParseStatus('parsing')
        try {
          await uploadAndParseResume(resume)
          setParseStatus('done')
        } catch (err) {
          console.error('Resume parse failed:', err)
          setParseStatus('error')
          setErrorMsg(`Resume upload failed: ${err.message}`)
          // Non-blocking — user can still continue after a short delay
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      // 4. Navigate
      if (!resume && skipResume) {
        navigate('/app/wishlist')
      } else {
        navigate('/app/swipe')
      }
    } catch (err) {
      console.error('Onboarding save failed:', err)
      setErrorMsg(`Save failed: ${err.message}`)
      // Still navigate after showing error briefly
      setTimeout(() => navigate(skipResume ? '/app/wishlist' : '/app/swipe'), 2000)
    } finally {
      setSaving(false)
    }
  }

  const canAdvance = () => {
    switch (currentStep) {
      case 'basics': return name.trim().length > 0
      case 'background': return degree.length > 0
      case 'resume': return resume || skipResume
      case 'preferences': return locations.length > 0 && dreamRoles.length > 0
      default: return true
    }
  }

  return (
    <div className="onb-page">
      {/* Background particles */}
      <div className="onb-bg">
        <div className="onb-glow onb-glow-1" />
        <div className="onb-glow onb-glow-2" />
      </div>

      {/* Progress bar */}
      <div className="onb-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`onb-progress-dot ${i <= step ? 'active' : ''} ${i === step ? 'current' : ''}`} />
        ))}
        <div className="onb-progress-bar">
          <div className="onb-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="onb-content" key={currentStep}>

        {/* Step 1: Basics */}
        {currentStep === 'basics' && (
          <div className="onb-step">
            <div className="onb-step-header">
              <h1 className="onb-title">Welcome aboard</h1>
              <p className="onb-subtitle">Let's set up your profile to find the best roles for you</p>
            </div>

            {/* Avatar */}
            <div className="onb-avatar-section">
              <button className="onb-avatar-btn" onClick={() => fileRef.current?.click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="onb-avatar-img" />
                  : <span className="onb-avatar-placeholder">{name?.[0]?.toUpperCase() || '?'}</span>
                }
                <span className="onb-avatar-edit">+</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
              <span className="onb-avatar-hint">Profile photo (optional)</span>
            </div>

            <div className="onb-fields">
              <div className="onb-field">
                <label className="onb-label">Full name</label>
                <input className="onb-input" value={name} onChange={e => setName(e.target.value)} placeholder="Alex Chen" />
              </div>
              <div className="onb-field">
                <label className="onb-label">Email</label>
                <input className="onb-input" value={email} disabled />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Background */}
        {currentStep === 'background' && (
          <div className="onb-step">
            <div className="onb-step-header">
              <h1 className="onb-title">Your background</h1>
              <p className="onb-subtitle">Help us understand where you're at in your journey</p>
            </div>

            <div className="onb-fields">
              <div className="onb-field">
                <label className="onb-label">Degree / Background</label>
                <div className="onb-chip-grid">
                  {DEGREE_OPTIONS.map(d => (
                    <button key={d} className={`onb-chip ${degree === d ? 'selected' : ''}`} onClick={() => setDegree(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onb-field">
                <label className="onb-label">University / Institution</label>
                <input className="onb-input" value={university} onChange={e => setUniversity(e.target.value)} placeholder="e.g. Monash University" />
              </div>

              <div className="onb-field">
                <label className="onb-label">Year level</label>
                <div className="onb-chip-row">
                  {['1st year', '2nd year', '3rd year', '4th year', 'Graduate', 'Working'].map(y => (
                    <button key={y} className={`onb-chip ${yearLevel === y ? 'selected' : ''}`} onClick={() => setYearLevel(y)}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onb-field">
                <label className="onb-label">Short bio (optional)</label>
                <textarea className="onb-textarea" value={background} onChange={e => setBackground(e.target.value)} placeholder="Tell us about your experience, interests, or what you're looking for..." rows={3} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Resume */}
        {currentStep === 'resume' && (
          <div className="onb-step">
            <div className="onb-step-header">
              <h1 className="onb-title">Your resume</h1>
              <p className="onb-subtitle">Upload your resume so we can tailor job matches for you</p>
            </div>

            <div className="onb-resume-zone" onClick={() => !resume && document.getElementById('resume-input')?.click()}>
              {resume ? (
                <div className="onb-resume-uploaded">
                  <span className="onb-resume-icon">&#128196;</span>
                  <span className="onb-resume-name">{resumeName}</span>
                  <button className="onb-resume-remove" onClick={(e) => { e.stopPropagation(); setResume(null); setResumeName('') }}>
                    &times;
                  </button>
                </div>
              ) : (
                <>
                  <span className="onb-resume-upload-icon">&#128195;</span>
                  <span className="onb-resume-upload-text">Tap to upload resume</span>
                  <span className="onb-resume-upload-hint">PDF or TXT (max 5MB)</span>
                </>
              )}
              <input id="resume-input" type="file" accept=".pdf,.txt" onChange={handleResumeChange} hidden />
            </div>

            <div className="onb-resume-divider">
              <span className="onb-resume-divider-line" />
              <span className="onb-resume-divider-text">or</span>
              <span className="onb-resume-divider-line" />
            </div>

            <button
              className={`onb-skip-resume-btn ${skipResume ? 'active' : ''}`}
              onClick={() => { setSkipResume(true); setResume(null); setResumeName('') }}
            >
              <span className="onb-skip-icon">&#129302;</span>
              <div className="onb-skip-text">
                <strong>I don't have a resume yet</strong>
                <span>Our AI Coach will help you build one from scratch</span>
              </div>
            </button>
          </div>
        )}

        {/* Step 4: Preferences */}
        {currentStep === 'preferences' && (
          <div className="onb-step">
            <div className="onb-step-header">
              <h1 className="onb-title">Your preferences</h1>
              <p className="onb-subtitle">Pick your dream locations and roles</p>
            </div>

            <div className="onb-fields">
              <div className="onb-field">
                <label className="onb-label">Preferred locations</label>
                <div className="onb-chip-grid">
                  {LOCATION_OPTIONS.map(loc => (
                    <button key={loc} className={`onb-chip ${locations.includes(loc) ? 'selected' : ''}`} onClick={() => toggleChip(loc, locations, setLocations)}>
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onb-field">
                <label className="onb-label">Dream roles</label>
                <div className="onb-chip-grid">
                  {ROLE_OPTIONS.map(role => (
                    <button key={role} className={`onb-chip ${dreamRoles.includes(role) ? 'selected' : ''}`} onClick={() => toggleChip(role, dreamRoles, setDreamRoles)}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '8px 16px', fontSize: '14px', margin: '0 24px' }}>
          {errorMsg}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="onb-nav">
        {step > 0 ? (
          <button className="onb-nav-btn back" onClick={goBack} disabled={saving}>Back</button>
        ) : (
          <div />
        )}
        {step < STEPS.length - 1 ? (
          <button className="onb-nav-btn next" onClick={goNext} disabled={!canAdvance()}>
            Continue
          </button>
        ) : (
          <button className="onb-nav-btn finish" onClick={handleFinish} disabled={!canAdvance() || saving}>
            {saving
              ? (parseStatus === 'parsing' ? 'Parsing resume...' : 'Saving...')
              : (skipResume ? 'Start with AI Coach' : 'Start Swiping')
            }
          </button>
        )}
      </div>
    </div>
  )
}
