import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { JOBS } from '../data/jobs'
import './SwipeFeed.css'

export default function SwipeFeed() {
  const [cardIdx, setCardIdx] = useState(0)
  const [swipeDir, setSwipeDir] = useState(null)
  const [liked, setLiked] = useState([])
  const [showDetail, setShowDetail] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const job = JOBS[cardIdx % JOBS.length]
  const next1 = JOBS[(cardIdx + 1) % JOBS.length]
  const next2 = JOBS[(cardIdx + 2) % JOBS.length]

  const doSwipe = useCallback((dir) => {
    if (swipeDir) return
    setSwipeDir(dir)
    if (dir === 'right') {
      setLiked(p => [...p, job])
    }
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
    const dx = e.clientX - dragStart.current.x
    setDragX(dx)
  }

  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > 100) {
      doSwipe(dragX > 0 ? 'right' : 'left')
    } else {
      setDragX(0)
    }
    dragStart.current = null
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const cardRotation = dragging ? dragX * 0.08 : 0
  const cardOpacity = dragging ? Math.max(0.5, 1 - Math.abs(dragX) / 400) : 1

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

            <div className="sf-glass-box">
              <div className="sf-label">About the role</div>
              <p className="sf-detail-desc">{job.desc}</p>
            </div>

            <div className="sf-glass-box">
              <div className="sf-label">Key responsibilities</div>
              {job.bullets.map((b, i) => (
                <div key={i} className="sf-bullet">
                  <span className="sf-dot" />
                  <span>{b}</span>
                </div>
              ))}
            </div>

            <div className="sf-glass-box">
              <div className="sf-label">Required skills</div>
              {job.skills.map((s, i) => (
                <div key={i} className="sf-bullet">
                  <span className="sf-dot sf-dot-blue" />
                  <span>{s}</span>
                </div>
              ))}
            </div>

            <div className="sf-match-box">
              <div className="sf-match-row">
                <span className="sf-match-label">Your AI match score</span>
                <span className="sf-match-value">{job.match}%</span>
              </div>
              <div className="sf-ats-bar">
                <div className="sf-ats-fill" style={{ width: `${job.match}%` }} />
              </div>
              <p className="sf-match-hint">Based on your profile, skills, and swipe history</p>
            </div>

            <div className="sf-detail-actions">
              <button className="sf-btn-ghost" onClick={() => { setShowDetail(false); doSwipe('left') }}>Skip ✕</button>
              <button className="sf-btn-grad" onClick={() => { setLiked(p => [...p, job]); setShowDetail(false); doSwipe('right') }}>Save ♥</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-page">
      <div className="sf-glow" />

      {/* Top bar */}
      <div className="sf-topbar">
        <div className="sf-brand">Land<span className="sf-brand-accent">It</span></div>
        <div className="sf-topbar-right">
          <span className="sf-liked-count">{liked.length} saved</span>
          <button className="sf-signout" onClick={handleSignOut}>Sign Out</button>
        </div>
      </div>

      {/* Card stack */}
      <div className="sf-stack-area">
        <div className="sf-stack">
          {/* Background cards */}
          {[next2, next1].map((j, si) => (
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

          {/* Front card */}
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
            {/* Swipe indicators */}
            {(dragX > 50 || swipeDir === 'right') && <div className="sf-stamp sf-stamp-yes">SAVE ♥</div>}
            {(dragX < -50 || swipeDir === 'left') && <div className="sf-stamp sf-stamp-no">SKIP</div>}

            <div className="sf-card-source">{job.source}</div>

            {/* Card hero */}
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

        {/* Action buttons */}
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
