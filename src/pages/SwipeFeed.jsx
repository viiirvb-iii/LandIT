import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { MELBOURNE_JOBS } from '../data/melbourneJobs'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { useJobActions } from '../context/JobActionsContext'
import { computeMatchScore } from '../services/resume'
import JobDetail from '../components/JobDetail'
import CompanyAvatar from '../components/CompanyAvatar'
import AICoach from '../components/AICoach'
import CoverLetter from '../components/CoverLetter'

const COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#ca8a04', '#0d9488']
const GRADIENT_PALETTES = [
  ['#065f46', '#059669', '#34d399'],   // emerald
  ['#1e3a8a', '#2563eb', '#60a5fa'],   // blue
  ['#4c1d95', '#7c3aed', '#a78bfa'],   // violet
  ['#9a3412', '#ea580c', '#fb923c'],   // orange
  ['#155e75', '#0891b2', '#22d3ee'],   // cyan
  ['#831843', '#db2777', '#f472b6'],   // pink
  ['#713f12', '#ca8a04', '#facc15'],   // amber
  ['#134e4a', '#0d9488', '#2dd4bf'],   // teal
]

function transformSupabaseJob(row, index, companiesMap, userSkills) {
  const fields = typeof row.job_description_fields === 'string'
    ? JSON.parse(row.job_description_fields) : row.job_description_fields || {}
  const skills = typeof row.skills_required === 'string'
    ? JSON.parse(row.skills_required) : row.skills_required || []
  const linkedCompany = companiesMap[row.company_id] || {}
  const company = fields.company_name || linkedCompany.name || row.title.split('@').pop()?.trim() || 'Company'
  const location = fields.location || (linkedCompany.locations && linkedCompany.locations[0]) || 'Remote'
  const pi = index % GRADIENT_PALETTES.length
  const skillNames = skills.map(s => typeof s === 'object' ? s.name : s)
  // Real match score from resume skills vs job skills (deterministic, no LLM)
  const match = userSkills && userSkills.length > 0
    ? computeMatchScore(userSkills, skills)
    : Math.floor(Math.random() * 30) + 65

  // Compare each job skill against user skills to set have/miss state
  const userSet = userSkills
    ? new Set(userSkills.map(s => (typeof s === 'object' ? s.name || s.skill || '' : s).toLowerCase().trim()))
    : null
  const taggedSkills = skillNames.map(name => {
    if (!userSet) return { name, state: 'ok' }
    const lower = name.toLowerCase().trim()
    // Exact match first (handles short names like "R", "AI", "Excel")
    if (userSet.has(lower)) return { name, state: 'have' }
    // Check if user has a skill that contains this one or vice versa (e.g. "React" ↔ "React.js")
    for (const us of userSet) {
      if ((us.length > 2 && lower.includes(us)) || (lower.length > 2 && us.includes(lower))) {
        return { name, state: 'have' }
      }
    }
    return { name, state: 'miss' }
  })

  return {
    id: row.id || fields.linkedin_id || `supa-${index}`,
    role: row.title, company, location, salary: '',
    type: fields.job_type || 'Full-time',
    source: 'LinkedIn',
    posted: row.posted_at || 'Recently',
    match,
    logo: company.charAt(0).toUpperCase(),
    logoUrl: fields.company_logo || linkedCompany.logo_url || null,
    color: COLORS[pi], g: GRADIENT_PALETTES[pi],
    tags: [location, fields.job_type || 'Full-time', ...skillNames.slice(0, 3)].filter(Boolean),
    desc: fields.summary || (row.raw_description || '').slice(0, 200) + '...',
    about: row.raw_description || fields.summary || '',
    bullets: [], skills: taggedSkills,
    reqs: [], docs: [], timeline: [], companyAbout: '', deadline: '', duration: '',
  }
}

export default function SwipeFeed({ showToast }) {
  const [swipeDir, setSwipeDir] = useState(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const [showCoverLetter, setShowCoverLetter] = useState(false)
  const [allJobs, setAllJobs] = useState([...MELBOURNE_JOBS])
  const dragStart = useRef(null)
  const toast = showToast || (() => {})
  const { boardJob, saveJob, passJob, boardedJobs, savedJobs, passedJobs } = useJobActions()

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return
    Promise.all([
      supabase.from('jobs').select('*').eq('is_active', true).order('posted_at', { ascending: false }),
      supabase.from('companies').select('id,name,logo_url,locations'),
      supabase.from('parsed_resumes').select('skills_extracted').limit(1).maybeSingle(),
    ]).then(([jobsRes, companiesRes, resumeRes]) => {
      const companiesMap = {}
      if (companiesRes.data) companiesRes.data.forEach(c => { companiesMap[c.id] = c })
      const userSkills = resumeRes?.data?.skills_extracted || null
      if (jobsRes.data && jobsRes.data.length > 0) {
        const scraped = jobsRes.data.map((row, i) => transformSupabaseJob(row, i, companiesMap, userSkills))
        setAllJobs([...scraped, ...MELBOURNE_JOBS])
      }
    }).catch(err => console.error('Supabase fetch failed:', err))
  }, [])

  /* Filter out already-swiped jobs */
  const swipedIds = useMemo(() => {
    const ids = new Set()
    boardedJobs.forEach(j => ids.add(j.id))
    savedJobs.forEach(j => ids.add(j.id))
    passedJobs.forEach(j => ids.add(j.id))
    return ids
  }, [boardedJobs, savedJobs, passedJobs])

  const availableJobs = useMemo(
    () => allJobs.filter(j => !swipedIds.has(j.id)),
    [allJobs, swipedIds]
  )

  const job = availableJobs[0] || null

  const doSwipe = useCallback((dir) => {
    if (swipeDir || !job) return
    setSwipeDir(dir)
    toast(dir === 'right' ? 'Added to boarding passes' : dir === 'left' ? 'Passed' : 'Saved to wishlist')
    setTimeout(() => {
      if (dir === 'right') boardJob(job)
      else if (dir === 'left') passJob(job)
      else saveJob(job)
      setSwipeDir(null)
      setDragX(0)
    }, 430)
  }, [swipeDir, toast, job, boardJob, saveJob, passJob])

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return
    dragStart.current = { x: e.clientX }; setDragging(true)
  }
  const onPointerMove = (e) => { if (!dragStart.current || !dragging) return; setDragX(e.clientX - dragStart.current.x) }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > 100) doSwipe(dragX > 0 ? 'right' : 'left')
    else setDragX(0)
    dragStart.current = null
  }

  const rot = dragging ? dragX * 0.08 : 0
  const opa = dragging ? Math.max(0.5, 1 - Math.abs(dragX) / 400) : 1
  const swipeCls = swipeDir === 'right' ? 'sf-swipe-r' : swipeDir === 'left' ? 'sf-swipe-l' : swipeDir === 'up' ? 'sf-swipe-u' : ''

  if (!job) return (
    <div className="sf-page" style={{ background: '#f5f5f7' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 40 }}>&#9992;</span>
        <span>No more jobs to show — check back later!</span>
      </div>
    </div>
  )

  return (
    <div className="sf-page" style={{ background: '#f5f5f7' }}>

      {/* ── Card Area ── */}
      <div className="sf-swipe-area">
        <div className="sf-card-stack">

          {/* Background cards */}
          <div className="sf-bg-card" style={{ transform: 'scale(0.88) translateY(20px)', zIndex: 0, opacity: 0.4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 26 }} />
          <div className="sf-bg-card" style={{ transform: 'scale(0.94) translateY(10px)', zIndex: 1, opacity: 0.7, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 26 }} />

          {/* ══ Main Card ══ */}
          <div
            className={`sf-main-card ${swipeCls}`}
            style={{
              position: 'absolute', inset: 0, zIndex: 2,
              borderRadius: 26, overflow: 'hidden',
              border: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column',
              background: '#fff',
              boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(37,99,235,0.06)',
              cursor: 'grab', userSelect: 'none', touchAction: 'pan-y',
              transform: !swipeDir ? `translateX(${dragX}px) rotate(${rot}deg)` : undefined,
              opacity: !swipeDir ? opa : undefined,
              transition: swipeDir ? undefined : 'transform 0.36s cubic-bezier(0.34,1.1,0.64,1), opacity 0.3s ease',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* Swipe stamps */}
            {dragX > 50 && (
              <div style={{
                position: 'absolute', top: 20, right: 16, zIndex: 10,
                fontWeight: 800, fontSize: 20, padding: '4px 14px', borderRadius: 8,
                border: '3px solid #16a34a', color: '#16a34a', background: 'rgba(22,163,74,0.08)',
                transform: 'rotate(8deg)', letterSpacing: 2,
              }}>BOARD</div>
            )}
            {dragX < -50 && (
              <div style={{
                position: 'absolute', top: 20, left: 16, zIndex: 10,
                fontWeight: 800, fontSize: 20, padding: '4px 14px', borderRadius: 8,
                border: '3px solid #dc2626', color: '#dc2626', background: 'rgba(220,38,38,0.08)',
                transform: 'rotate(-8deg)', letterSpacing: 2,
              }}>SKIP</div>
            )}

            {/* ── Hero ── */}
            <div style={{
              height: 155, flexShrink: 0, position: 'relative', overflow: 'hidden',
              background: `linear-gradient(160deg, ${job.g[0]}, ${job.g[1]}, ${job.g[2]}40)`,
            }}>
              {/* Overlay gradient */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 100%)',
              }} />

              {/* Hero content */}
              <div style={{ position: 'absolute', bottom: 14, left: 15, right: 15, zIndex: 2 }}>
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 5,
                }}>
                  {job.match}% match · {job.source}
                </div>
                <div style={{
                  fontSize: 19, fontWeight: 700, color: '#fff',
                  lineHeight: 1.1, letterSpacing: '-0.02em',
                }}>{job.role}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                  <CompanyAvatar logoUrl={job.logoUrl} company={job.company} color={job.color} size={28} radius={8} fontSize={12} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}>
                    {job.company} · {job.location}
                  </span>
                  <div style={{
                    marginLeft: 'auto', background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20,
                    padding: '3px 9px', fontSize: 10, color: '#fff', fontWeight: 500,
                    backdropFilter: 'blur(10px)',
                  }}>{job.match}%</div>
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              {/* Salary + Type row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {job.salary && (
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: '#16a34a',
                    letterSpacing: '-0.02em',
                  }}>{job.salary}</span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 500, color: '#64748b',
                  padding: '3px 9px', borderRadius: 20,
                  background: '#f1f5f9', border: '1px solid #e2e8f0',
                }}>{job.type}</span>
              </div>

              {/* Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {job.tags.slice(0, 4).map(t => (
                  <span key={t} style={{
                    padding: '4px 10px', borderRadius: 20,
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    fontSize: 10, color: '#64748b', fontWeight: 400, letterSpacing: '-0.01em',
                  }}>{t}</span>
                ))}
              </div>

              {/* Fit bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>Flight match</span>
                <div style={{ flex: 1, height: 3, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${job.match}%`, background: '#3b82f6', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{job.match}%</span>
              </div>

              {/* Description */}
              <p style={{
                fontSize: 13, color: '#64748b', lineHeight: 1.6,
                fontWeight: 400, overflow: 'hidden', margin: 0,
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
              }}>{job.desc}</p>
            </div>

            {/* ── Actions ── */}
            <div style={{
              flexShrink: 0, padding: '8px 12px 10px', display: 'flex', gap: 6,
              background: '#fafbfc', borderTop: '1px solid #f1f5f9',
            }}>
              {[
                { label: 'Company', icon: 'i', onClick: () => setShowDetail(true) },
                { label: 'AI Coach', icon: '\u2726', onClick: () => setShowCoach(true), primary: true },
                { label: 'Cover Letter', icon: '\u2709', onClick: () => setShowCoverLetter(true) },
              ].map(btn => (
                <button key={btn.label} onClick={(e) => { e.stopPropagation(); btn.onClick() }}
                  style={{
                    flex: 1, padding: '9px 4px 8px', borderRadius: 12, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    transition: 'all 0.15s', letterSpacing: '-0.01em', fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                    ...(btn.primary
                      ? { background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6' }
                      : btn.star
                        ? { background: '#fffbeb', border: '1px solid #fde68a', color: '#f59e0b' }
                        : { background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }
                    ),
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{btn.icon}</span>
                  <span style={{ fontSize: 8, lineHeight: 1.2, textAlign: 'center' }}>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Swipe Buttons ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 14, padding: '8px 0 6px', flexShrink: 0,
      }}>
        <button onClick={() => doSwipe('left')} className="sf-sw-btn" style={{
          width: 48, height: 48, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.20)',
          transition: 'transform 0.15s, opacity 0.15s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button onClick={() => doSwipe('right')} className="sf-sw-btn" style={{
          width: 58, height: 58, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#3b82f6', border: 'none',
          boxShadow: '0 6px 20px rgba(59,130,246,0.30), 0 2px 6px rgba(0,0,0,0.08)',
          transition: 'transform 0.15s, opacity 0.15s',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#fff"/>
          </svg>
        </button>
        <button onClick={() => doSwipe('up')} className="sf-sw-btn" style={{
          width: 48, height: 48, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.20)',
          transition: 'transform 0.15s, opacity 0.15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>

      {/* ── Overlays ── */}
      <JobDetail job={job} open={showDetail} onClose={() => setShowDetail(false)}
        onApply={() => { toast('Added to boarding passes'); setShowDetail(false) }}
        onSave={() => { toast('Saved to wishlist'); setShowDetail(false) }}
        onOpenCoach={() => { setShowDetail(false); setShowCoach(true) }}
        onOpenCoverLetter={() => { setShowDetail(false); setShowCoverLetter(true) }}
      />
      <AICoach job={job} open={showCoach} onClose={() => setShowCoach(false)} onToast={toast} />
      <CoverLetter job={job} open={showCoverLetter} onClose={() => setShowCoverLetter(false)} onToast={toast} />

      <style>{`
        .sf-page {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; position: relative; min-height: 0;
        }
        .sf-swipe-area {
          flex: 1; padding: 8px 14px 6px;
          position: relative; overflow: hidden; min-height: 0;
        }
        .sf-card-stack {
          position: relative; height: 100%;
          min-height: 480px; max-width: 420px; margin: 0 auto;
        }
        .sf-bg-card {
          position: absolute; inset: 0;
        }
        .sf-sw-btn:hover { transform: scale(1.08); }
        .sf-sw-btn:active { transform: scale(0.94) !important; opacity: 0.8; }
        @keyframes swipeR { to { transform: translateX(360px) rotate(16deg); opacity: 0; } }
        @keyframes swipeL { to { transform: translateX(-360px) rotate(-16deg); opacity: 0; } }
        @keyframes swipeU { to { transform: translateY(-320px) scale(0.8); opacity: 0; } }
        .sf-swipe-r { animation: swipeR 0.43s cubic-bezier(0.55,0,1,0.45) forwards !important; }
        .sf-swipe-l { animation: swipeL 0.43s cubic-bezier(0.55,0,1,0.45) forwards !important; }
        .sf-swipe-u { animation: swipeU 0.43s cubic-bezier(0.55,0,1,0.45) forwards !important; }
        @media (min-width: 481px) {
          .sf-card-stack { max-width: 400px; }
          .sf-sw-btn:hover { transform: scale(1.12); }
        }
      `}</style>
    </div>
  )
}
