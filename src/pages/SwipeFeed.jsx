import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSwipeFeed } from '../services/jobs'
import './SwipeFeed.css'

// Deterministic gradient per card index
const GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#ff9a9e', '#fecfef'],
  ['#ffecd2', '#fcb69f'],
]

function mapJob(j, idx) {
  const company = j.companies ?? {}
  const desc = j.job_description_fields ?? {}
  const location =
    desc.location ??
    (Array.isArray(company.locations) ? company.locations[0] : null) ??
    'Remote'
  const tags = (j.skills_required ?? []).slice(0, 6).map(s => s.name)
  const skills = (j.skills_required ?? []).map(s =>
    s.level ? `${s.name} (${s.level})` : s.name
  )

  return {
    id: j.id,
    role: j.title,
    company: company.name ?? 'Unknown',
    location,
    salary: desc.salary ?? 'Competitive',
    type: j.job_type ?? desc.job_type ?? 'Full-time',
    source: 'LandIt',
    posted: j.posted_at ? new Date(j.posted_at).toLocaleDateString() : 'Recently',
    match: 0,
    logo: (company.name ?? 'J')[0].toUpperCase(),
    g: GRADIENTS[idx % GRADIENTS.length],
    tags,
    desc: desc.summary ?? company.description ?? '',
    bullets: [],
    skills,
  }
}

export default function SwipeFeed() {
  const [jobs, setJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [cardIdx, setCardIdx] = useState(0)
  const [swipeDir, setSwipeDir] = useState(null)
  const [liked, setLiked] = useState([])
  const [showDetail, setShowDetail] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    getSwipeFeed({ limit: 50 })
      .then(data => setJobs(data.map(mapJob)))
      .catch(err => setFetchError(err.message ?? 'Failed to load jobs'))
      .finally(() => setLoadingJobs(false))
  }, [])

  const job   = jobs[cardIdx % Math.max(jobs.length, 1)]
  const next1 = jobs[(cardIdx + 1) % Math.max(jobs.length, 1)]
  const next2 = jobs[(cardIdx + 2) % Math.max(jobs.length, 1)]

  const doSwipe = useCallback((dir) => {
    if (swipeDir || !job) return
    setSwipeDir(dir)
    if (dir === 'right') setLiked(p => [...p, job])
    setTimeout(() => {
      setSwipeDir(null)
      setDragX(0)
      setCardIdx(i => i + 1)
    }, 430)
  }, [swipeDir, job])

  const onPointerDown = (e) => {
    dragStart.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const onPointerMove = (e) => {
    if (!dragStart.current || !dragging) return
    setDragX(e.clientX - dragStart.current.x)
  }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > 100) doSwipe(dragX > 0 ? 'right' : 'left')
    else setDragX(0)
    dragStart.current = null
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const cardRotation = dragging ? dragX * 0.08 : 0
  const cardOpacity  = dragging ? Math.max(0.5, 1 - Math.abs(dragX) / 400) : 1

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingJobs) {
    return (
      <div className="sf-page">
        <div className="sf-glow" />
        <div className="sf-topbar">
          <div className="sf-brand">Land<span className="sf-brand-accent">It</span></div>
        </div>
        <div className="sf-stack-area">
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✈</div>
            Loading flights…
          </div>
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="sf-page">
        <div className="sf-glow" />
        <div className="sf-topbar">
          <div className="sf-brand">Land<span className="sf-brand-accent">It</span></div>
          <button className="sf-signout" onClick={handleSignOut}>Sign Out</button>
        </div>
        <div className="sf-stack-area">
          <div style={{ textAlign: 'center', color: '#dc2626', fontSize: 14, padding: '0 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            {fetchError}
          </div>
        </div>
      </div>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!jobs.length) {
    return (
      <div className="sf-page">
        <div className="sf-glow" />
        <div className="sf-topbar">
          <div className="sf-brand">Land<span className="sf-brand-accent">It</span></div>
          <button className="sf-signout" onClick={handleSignOut}>Sign Out</button>
        </div>
        <div className="sf-stack-area">
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🛬</div>
            No active flights right now.
          </div>
        </div>
      </div>
    )
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (showDetail) {
    return (
      <div className="sf-page">
        <div className="sf-glow" />
        <div className="sf-detail">
          <div className="sf-detail-hero" style={{ background: `linear-gradient(160deg, ${job.g[0]}33, ${job.g[1]}55)` }}>
            <button className="sf-back-btn" onClick={() => setShowDetail(false)}>← Back</button>
            <div className="sf-detail-hero-inner">
              <div className="sf-logo-lg" style={{ background: `linear-gradient(135deg, ${job.g[0]}, ${job.g[1]})` }}>{job.logo}</div>
              <div>
                <h2 className="sf-detail-title">{job.role}</h2>
                <p className="sf-detail-sub">{job.company} · {job.location}</p>
              </div>
            </div>
          </div>

          <div className="sf-detail-body">
            <div className="sf-pills">
              {[job.salary, job.type, job.posted, job.source].map(c => (
                <span key={c} className="sf-pill">{c}</span>
              ))}
            </div>
            <div className="sf-pills" style={{ marginBottom: 24 }}>
              {job.tags.map(t => (
                <span key={t} className="sf-pill sf-pill-pink">{t}</span>
              ))}
            </div>

            {job.desc && (
              <div className="sf-glass-box">
                <div className="sf-label">About the role</div>
                <p className="sf-detail-desc">{job.desc}</p>
              </div>
            )}

            {job.bullets.length > 0 && (
              <div className="sf-glass-box">
                <div className="sf-label">Key responsibilities</div>
                {job.bullets.map((b, i) => (
                  <div key={i} className="sf-bullet">
                    <span className="sf-dot" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}

            {job.skills.length > 0 && (
              <div className="sf-glass-box">
                <div className="sf-label">Required skills</div>
                {job.skills.map((s, i) => (
                  <div key={i} className="sf-bullet">
                    <span className="sf-dot sf-dot-blue" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="sf-detail-actions">
              <button className="sf-btn-ghost" onClick={() => { setShowDetail(false); doSwipe('left') }}>Skip ✕</button>
              <button className="sf-btn-grad" onClick={() => { setLiked(p => [...p, job]); setShowDetail(false); doSwipe('right') }}>Save ♥</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main swipe view ───────────────────────────────────────────────────────
  return (
    <div className="sf-page">
      <div className="sf-glow" />

      <div className="sf-topbar">
        <div className="sf-brand">Land<span className="sf-brand-accent">It</span></div>
        <div className="sf-topbar-right">
          <span className="sf-liked-count">{liked.length} saved</span>
          <button className="sf-signout" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      <div className="sf-stack-area">
        <div className="sf-stack">
          {[next2, next1].map((j, si) => j && (
            <div key={j.id + '-bg-' + si} className="sf-card-bg" style={{
              transform: `scale(${0.88 + si * 0.06}) translateY(${(1 - si) * 12}px)`,
              zIndex: si,
              opacity: 0.4 + si * 0.2,
            }}>
              <div className="sf-card-bg-inner">
                <div className="sf-logo-sm" style={{ background: `linear-gradient(135deg, ${j.g[0]}, ${j.g[1]})` }}>{j.logo}</div>
                <div className="sf-card-bg-title">{j.role}</div>
              </div>
            </div>
          ))}

          <div
            className={`sf-card-front ${swipeDir === 'right' ? 'sf-swipe-r' : swipeDir === 'left' ? 'sf-swipe-l' : ''}`}
            style={{
              transform: !swipeDir ? `translateX(${dragX}px) rotate(${cardRotation}deg)` : undefined,
              opacity: !swipeDir ? cardOpacity : undefined,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {(dragX > 50 || swipeDir === 'right') && <div className="sf-stamp sf-stamp-yes">SAVE ♥</div>}
            {(dragX < -50 || swipeDir === 'left')  && <div className="sf-stamp sf-stamp-no">SKIP</div>}

            <div className="sf-card-source">{job.source}</div>

            <div className="sf-card-hero" style={{ background: `linear-gradient(135deg, ${job.g[0]}22, ${job.g[1]}44)` }}>
              <div className="sf-logo-md" style={{ background: `linear-gradient(135deg, ${job.g[0]}, ${job.g[1]})`, boxShadow: `0 8px 24px ${job.g[0]}55` }}>{job.logo}</div>
              <div>
                <div className="sf-card-role">{job.role}</div>
                <div className="sf-card-company">{job.company} · {job.location}</div>
              </div>
            </div>

            <div className="sf-pills sf-card-tags">
              {job.tags.slice(0, 4).map(t => <span key={t} className="sf-pill">{t}</span>)}
            </div>

            <div className="sf-card-salary-row">
              <div className="sf-card-salary">{job.salary}</div>
              <div className="sf-card-type">{job.type}</div>
            </div>

            <div className="sf-card-match">
              <div className="sf-card-match-row">
                <span>AI match</span>
                <span className="sf-card-match-pct">{job.match}%</span>
              </div>
              <div className="sf-ats-bar"><div className="sf-ats-fill" style={{ width: `${job.match}%` }} /></div>
            </div>

            <button className="sf-card-detail-btn" onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}>
              View full description →
            </button>
          </div>
        </div>

        <div className="sf-actions">
          <button className="sf-action-btn sf-action-no" onClick={() => doSwipe('left')}>✕</button>
          <div className="sf-action-divider">
            <span className="sf-action-label">SWIPE</span>
            <div className="sf-action-line" />
          </div>
          <button className="sf-action-btn sf-action-yes" onClick={() => doSwipe('right')}>♥</button>
        </div>
        <div className="sf-hint">
          {liked.length > 0 ? `${liked.length} saved · swipe right to save more` : 'swipe right to save · left to skip'}
        </div>
      </div>
    </div>
  )
}
