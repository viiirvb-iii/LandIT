import { useState, useRef, useCallback } from 'react'
import { JOBS } from '../data/jobs'
import JobDetail from '../components/JobDetail'
import AutoTailor from '../components/AutoTailor'
import AICoach from '../components/AICoach'
import './SwipeFeed.css'

export default function SwipeFeed({ showToast }) {
  const [cardIdx, setCardIdx] = useState(0)
  const [swipeDir, setSwipeDir] = useState(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showTailor, setShowTailor] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const dragStart = useRef(null)

  const job = JOBS[cardIdx % JOBS.length]

  const toast = showToast || (() => {})

  const doSwipe = useCallback((dir) => {
    if (swipeDir) return
    setSwipeDir(dir)
    if (dir === 'right') {
      toast('✈ Added to boarding passes')
    } else if (dir === 'left') {
      toast('Passed')
    } else {
      toast('★ Saved to wishlist')
    }
    setTimeout(() => {
      setSwipeDir(null)
      setDragX(0)
      setCardIdx(i => i + 1)
    }, 430)
  }, [swipeDir, job, toast])

  const onPointerDown = (e) => {
    dragStart.current = { x: e.clientX }
    setDragging(true)
  }
  const onPointerMove = (e) => {
    if (!dragStart.current || !dragging) return
    setDragX(e.clientX - dragStart.current.x)
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

  const cardRotation = dragging ? dragX * 0.08 : 0
  const cardOpacity = dragging ? Math.max(0.5, 1 - Math.abs(dragX) / 400) : 1

  return (
    <div className="sf-page">
      <div className="sf-swipe-area">
        <div className="sf-card-stack">
          {/* Background cards */}
          <div className="sf-bg-card sf-bg3" />
          <div className="sf-bg-card sf-bg2" />

          {/* Front card */}
          <div
            className={`sf-job-card ${swipeDir === 'right' ? 'sf-swipe-r' : swipeDir === 'left' ? 'sf-swipe-l' : swipeDir === 'up' ? 'sf-swipe-u' : ''}`}
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
            {dragX > 50 && <div className="sf-stamp sf-stamp-yes">SAVE ♥</div>}
            {dragX < -50 && <div className="sf-stamp sf-stamp-no">SKIP</div>}

            {/* Hero */}
            <div className="sf-card-hero" style={{ background: `linear-gradient(160deg, ${job.g[0]}15, ${job.g[1]}25, ${job.g[2]}18)` }}>
              <div className="sf-card-hero-content">
                <div className="sf-card-eyebrow">✈ {job.match}% match · {job.location}</div>
                <div className="sf-card-role">{job.role}</div>
                <div className="sf-card-co-row">
                  <div className="sf-card-co-badge" style={{ background: job.color }}>{job.logo}</div>
                  <div className="sf-card-co-name">{job.company} · {job.location}</div>
                  <div className="sf-card-pay">{job.salary}</div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="sf-card-body">
              <div className="sf-chips">
                {job.tags.slice(0, 4).map(t => (
                  <span key={t} className="sf-chip">{t}</span>
                ))}
              </div>

              <div className="sf-fit-row">
                <span className="sf-fit-label">Flight match</span>
                <div className="sf-fit-bar">
                  <div className="sf-fit-fill" style={{ width: `${job.match}%` }} />
                </div>
                <span className="sf-fit-pct">{job.match}%</span>
              </div>

              <div className="sf-card-desc">{job.desc}</div>
            </div>

            {/* Actions */}
            <div className="sf-card-actions">
              <button className="sf-act-btn" onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}>
                <span className="sf-act-icon">ℹ</span>
                <span className="sf-act-lbl">Company</span>
              </button>
              <button className="sf-act-btn sf-act-primary" onClick={(e) => { e.stopPropagation(); setShowCoach(true) }}>
                <span className="sf-act-icon">✦</span>
                <span className="sf-act-lbl">AI Coach</span>
              </button>
              <button className="sf-act-btn" onClick={(e) => { e.stopPropagation(); setShowTailor(true) }}>
                <span className="sf-act-icon">⚡</span>
                <span className="sf-act-lbl">Auto-tailor</span>
              </button>
              <button className="sf-act-btn sf-act-star" onClick={(e) => { e.stopPropagation(); doSwipe('up') }}>
                <span className="sf-act-icon">★</span>
                <span className="sf-act-lbl">Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Swipe buttons */}
      <div className="sf-swipe-btns">
        <button className="sf-sw-btn sf-sw-pass" onClick={() => doSwipe('left')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button className="sf-sw-btn sf-sw-love" onClick={() => doSwipe('right')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#fff"/>
          </svg>
        </button>
        <button className="sf-sw-btn sf-sw-save" onClick={() => doSwipe('up')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="12 2 12 22"/><polyline points="6 8 12 2 18 8"/>
          </svg>
        </button>
      </div>

      {/* Overlays */}
      <JobDetail
        job={job}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onApply={() => { toast('✈ Added to boarding passes'); setShowDetail(false) }}
        onSave={() => { toast('★ Saved to wishlist'); setShowDetail(false) }}
        onOpenTailor={() => { setShowDetail(false); setShowTailor(true) }}
        onOpenCoach={() => { setShowDetail(false); setShowCoach(true) }}
      />

      <AutoTailor
        job={job}
        open={showTailor}
        onClose={() => setShowTailor(false)}
        onToast={toast}
      />

      <AICoach
        job={job}
        open={showCoach}
        onClose={() => setShowCoach(false)}
        onToast={toast}
      />
    </div>
  )
}
