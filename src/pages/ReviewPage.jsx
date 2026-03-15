import { useRef, useEffect, useMemo, useState } from 'react'
import { useJobActions } from '../context/JobActionsContext'
import JobDetail from '../components/JobDetail'
import './ReviewPage.css'

const STATUS_META = {
  landed:     { label: 'LANDED',          cls: 'landed'     },
  inflight:   { label: 'IN-FLIGHT',       cls: 'inflight'   },
  uploaded:   { label: 'RESUME SENT',     cls: 'uploaded'   },
  downloaded: { label: 'REVIEWED',        cls: 'downloaded' },
  departed:   { label: 'DEPARTED',        cls: 'departed'   },
}

const STATUS_FLOW = ['inflight', 'uploaded', 'downloaded', 'landed']

const STATUS_COLORS = {
  landed:     '#30d158',
  inflight:   '#ffd60a',
  uploaded:   '#3a82f6',
  downloaded: '#a78bfa',
  departed:   '#ff453a',
  saved:      '#3a82f6',
}

/* ── Earth Radar Globe ── */
function EarthRadar({ applied, saved }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const allNodes = useMemo(() => {
    const a = applied.map(j => ({ ...j, kind: 'applied' }))
    const s = saved.map(j => ({ ...j, kind: 'saved' }))
    return [...a, ...s]
  }, [applied, saved])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.parentElement?.clientWidth || 480
    const H = 280
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = '100%'
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    const cx = W / 2, cy = H / 2
    const R = Math.min(W, H) * 0.36

    /* continent-like land masses (simplified arcs) */
    const continents = [
      { cx: -0.15, cy: -0.25, rx: 0.22, ry: 0.18 },
      { cx: 0.25, cy: -0.15, rx: 0.28, ry: 0.22 },
      { cx: -0.30, cy: 0.15, rx: 0.12, ry: 0.18 },
      { cx: 0.10, cy: 0.30, rx: 0.18, ry: 0.10 },
      { cx: 0.35, cy: 0.20, rx: 0.14, ry: 0.16 },
      { cx: -0.05, cy: 0.05, rx: 0.08, ry: 0.06 },
    ]

    /* grid lines */
    const gridLats = [-0.6, -0.3, 0, 0.3, 0.6]
    const gridLons = [-0.6, -0.3, 0, 0.3, 0.6]

    /* stars / ambient dots */
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.5 + Math.random() * 1.2, phase: Math.random() * Math.PI * 2,
    }))

    /* place nodes in orbit around the globe */
    const placed = allNodes.map((n, i) => {
      const total = Math.max(allNodes.length, 1)
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2
      const dist = R + 28 + (i % 3) * 14
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        letter: n.logo || n.company?.[0] || '?',
        color: n.color || '#94a3b8',
        statusColor: n.kind === 'saved' ? STATUS_COLORS.saved : (STATUS_COLORS[n.status] || STATUS_COLORS.inflight),
        phase: Math.random() * Math.PI * 2,
        kind: n.kind,
        location: n.location || '',
        company: n.company || '',
      }
    })

    /* radar sweep */
    let t = 0
    function draw() {
      t += 0.006
      ctx.clearRect(0, 0, W, H)

      /* stars */
      stars.forEach(s => {
        const a = 0.15 + 0.1 * Math.sin(t * 2 + s.phase)
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(148,163,184,${a})`; ctx.fill()
      })

      /* globe fill */
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
      const grd = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
      grd.addColorStop(0, 'rgba(20,40,80,0.6)')
      grd.addColorStop(0.5, 'rgba(10,20,50,0.4)')
      grd.addColorStop(1, 'rgba(6,9,15,0.3)')
      ctx.fillStyle = grd; ctx.fill()

      /* globe outline */
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(58,130,246,0.25)'; ctx.lineWidth = 1.5; ctx.stroke()

      /* grid lines (latitude) */
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip()
      gridLats.forEach(lat => {
        const y = cy + lat * R
        const halfW = Math.sqrt(Math.max(0, R * R - (lat * R) * (lat * R)))
        ctx.beginPath(); ctx.moveTo(cx - halfW, y); ctx.lineTo(cx + halfW, y)
        ctx.strokeStyle = 'rgba(58,130,246,0.08)'; ctx.lineWidth = 0.5; ctx.stroke()
      })
      /* grid lines (longitude) */
      gridLons.forEach(lon => {
        const offset = lon * R
        ctx.beginPath()
        ctx.ellipse(cx + offset * 0.5, cy, Math.abs(offset) * 0.3 + 2, R, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(58,130,246,0.06)'; ctx.lineWidth = 0.5; ctx.stroke()
      })

      /* continents */
      const rotOffset = t * 0.3
      continents.forEach(c => {
        const lx = cx + (c.cx + Math.sin(rotOffset) * 0.05) * R * 2
        const ly = cy + c.cy * R * 2
        ctx.beginPath()
        ctx.ellipse(lx, ly, c.rx * R, c.ry * R, 0.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(58,130,246,0.12)'; ctx.fill()
        ctx.strokeStyle = 'rgba(58,130,246,0.18)'; ctx.lineWidth = 0.5; ctx.stroke()
      })
      ctx.restore()

      /* radar sweep line */
      const sweepAngle = t * 1.2
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R)
      ctx.strokeStyle = 'rgba(58,130,246,0.35)'; ctx.lineWidth = 1.5; ctx.stroke()

      /* radar sweep glow */
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, sweepAngle - 0.4, sweepAngle, false)
      ctx.closePath()
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      sg.addColorStop(0, 'rgba(58,130,246,0.0)')
      sg.addColorStop(0.5, 'rgba(58,130,246,0.06)')
      sg.addColorStop(1, 'rgba(58,130,246,0.12)')
      ctx.fillStyle = sg; ctx.fill()

      /* center hub - Melbourne */
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#3a82f6'; ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(58,130,246,0.4)'; ctx.lineWidth = 1; ctx.stroke()
      /* pulse ring */
      const pulseR = 8 + (1 + Math.sin(t * 3)) * 6
      ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(58,130,246,${0.2 - (pulseR - 8) * 0.015})`; ctx.lineWidth = 1; ctx.stroke()

      /* MELB label */
      ctx.font = '600 8px -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(58,130,246,0.6)'
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText('MELB', cx, cy + 13)

      /* connection lines + nodes */
      placed.forEach(n => {
        const wobX = Math.sin(t + n.phase) * 2.5
        const wobY = Math.cos(t * 0.7 + n.phase) * 2.5
        const nx = n.x + wobX, ny = n.y + wobY

        /* curved connection */
        ctx.beginPath(); ctx.moveTo(cx, cy)
        const cpx = (cx + nx) / 2 + (ny - cy) * 0.15
        const cpy = (cy + ny) / 2 - (nx - cx) * 0.15
        ctx.quadraticCurveTo(cpx, cpy, nx, ny)
        const lineAlpha = 0.08 + 0.05 * Math.sin(t * 1.5 + n.phase)
        ctx.strokeStyle = n.kind === 'saved'
          ? `rgba(58,130,246,${lineAlpha})`
          : `rgba(255,255,255,${lineAlpha})`
        ctx.lineWidth = 0.8
        ctx.setLineDash(n.kind === 'saved' ? [3, 3] : [])
        ctx.stroke()
        ctx.setLineDash([])

        /* node glow */
        const glowGrd = ctx.createRadialGradient(nx, ny, 0, nx, ny, 12)
        glowGrd.addColorStop(0, n.statusColor + '20')
        glowGrd.addColorStop(1, n.statusColor + '00')
        ctx.fillStyle = glowGrd
        ctx.fillRect(nx - 12, ny - 12, 24, 24)

        /* node dot */
        ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2)
        ctx.fillStyle = n.color; ctx.fill()

        /* status ring */
        ctx.beginPath(); ctx.arc(nx, ny, 7, 0, Math.PI * 2)
        ctx.strokeStyle = n.statusColor; ctx.lineWidth = 1.5; ctx.stroke()
      })

      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [allNodes])

  return <canvas ref={canvasRef} />
}

/* ── Boarding Pass Card ── */
function BoardingPassCard({ job, onToast, onOpenDetail, onDelete, onAdvanceStatus }) {
  const meta = STATUS_META[job.status] || STATUS_META.inflight
  const skillsToShow = (job.skills || []).slice(0, 4)
  const currentIdx = STATUS_FLOW.indexOf(job.status)
  const canAdvance = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
  const nextStatus = canAdvance ? STATUS_FLOW[currentIdx + 1] : null
  const nextLabel = nextStatus ? STATUS_META[nextStatus]?.label : null

  return (
    <div className={`review-card ${job.status === 'inflight' ? 'review-card--inflight' : ''}`}>
      <div className="review-card-top">
        <div className="review-card-logo" style={{ background: job.color }}>
          {job.logoUrl
            ? <img src={job.logoUrl} alt={job.company} style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = job.logo }} />
            : job.logo}
        </div>
        <div className="review-card-info">
          <div className="review-card-company">{job.company}</div>
          <div className="review-card-role">{job.role}</div>
          {job.location && (
            <div className="review-card-location">{job.location}</div>
          )}
        </div>
        <div className="review-card-status-area">
          <span className={`review-status-badge ${meta.cls}`}>{meta.label}</span>
          <button className="review-card-delete" onClick={() => onDelete(job.id)} title="Remove">
            &times;
          </button>
        </div>
      </div>

      {/* Status progress tracker */}
      <div className="review-status-track">
        {STATUS_FLOW.map((step, i) => {
          const stepIdx = STATUS_FLOW.indexOf(job.status)
          const done = i <= stepIdx
          return (
            <div key={step} className="review-status-step">
              <div className={`review-status-dot-track ${done ? 'done' : ''} ${step === job.status ? 'current' : ''}`} />
              {i < STATUS_FLOW.length - 1 && (
                <div className={`review-status-line ${i < stepIdx ? 'done' : ''}`} />
              )}
            </div>
          )
        })}
        <div className="review-status-labels">
          {STATUS_FLOW.map(step => (
            <span key={step} className="review-status-step-label">{STATUS_META[step].label}</span>
          ))}
        </div>
      </div>

      {/* Description preview */}
      {job.desc && (
        <div className="review-card-desc">{job.desc}</div>
      )}

      {/* Skill tags */}
      {skillsToShow.length > 0 && (
        <div className="review-card-skills">
          {skillsToShow.map((s, i) => {
            const name = typeof s === 'object' ? s.name : s
            const state = typeof s === 'object' ? s.state : 'have'
            return (
              <span key={i} className={`review-skill-chip ${state}`}>{name}</span>
            )
          })}
        </div>
      )}

      <div className="review-perforation">
        <div className="review-perforation-line" />
        <div className="review-perforation-notch left" />
        <div className="review-perforation-notch right" />
      </div>

      <div className="review-stats-strip">
        <div className="review-stat">
          <div className="review-stat-label">Salary</div>
          <div className="review-stat-value">{job.salary || '—'}</div>
        </div>
        <div className="review-stat">
          <div className="review-stat-label">Type</div>
          <div className="review-stat-value">{job.type || 'Full-time'}</div>
        </div>
        <div className="review-stat">
          <div className="review-stat-label">Added</div>
          <div className="review-stat-value">{job.appliedDate || 'Today'}</div>
        </div>
        <div className="ps-match">{job.match}%</div>
      </div>

      <div className="review-actions">
        {canAdvance && (
          <button className="review-action-btn advance" onClick={() => onAdvanceStatus(job.id, nextStatus)}>
            {nextLabel}
          </button>
        )}
        <button className="review-action-btn details" onClick={() => onOpenDetail(job)}>Details</button>
      </div>
    </div>
  )
}

/* ── Saved/Wishlist Card (with avatar) ── */
function SavedCard({ job, onBoard, onRemove }) {
  return (
    <div className="review-saved-card">
      <div className="review-saved-avatar" style={{ background: job.color }}>
        {job.logoUrl
          ? <img src={job.logoUrl} alt={job.company} style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = job.logo }} />
          : job.logo}
      </div>
      <div className="review-saved-info">
        <div className="review-saved-role">{job.role}</div>
        <div className="review-saved-company">{job.company}</div>
        <div className="review-saved-meta">{job.location} · {job.match}% match</div>
      </div>
      <div className="review-saved-actions">
        <button className="review-saved-btn board" onClick={() => onBoard(job)}>Board</button>
        <button className="review-saved-btn remove" onClick={() => onRemove(job.id)}>&times;</button>
      </div>
    </div>
  )
}

/* ── ReviewPage ── */
export default function ReviewPage({ onToast }) {
  const { boardedJobs, savedJobs, removeSaved, removeBoarded, boardJob, updateBoardedStatus } = useJobActions()
  const [detailJob, setDetailJob] = useState(null)

  const allPasses = [...boardedJobs]

  return (
    <div className="review-page">
      {/* Earth Radar */}
      <div className="review-globe-section">
        <EarthRadar applied={allPasses} saved={savedJobs} />
        <div className="review-globe-title">Your Applications Radar</div>
      </div>

      <div className="review-legend-bar">
        <div className="review-legend-item"><span className="review-legend-dot landed" /> Landed</div>
        <div className="review-legend-item"><span className="review-legend-dot inflight" /> In-flight</div>
        <div className="review-legend-item"><span className="review-legend-dot departed" /> Departed</div>
        <div className="review-legend-item"><span className="review-legend-dot saved" /> Saved</div>
      </div>

      <div className="review-cards-list">
        {allPasses.length === 0 && savedJobs.length === 0 ? (
          <div className="review-empty">
            <div className="review-empty-icon">&#9992;</div>
            <div className="review-empty-text">No applications yet. Swipe right on jobs to board them!</div>
          </div>
        ) : (
          <>
            {allPasses.length > 0 && (
              <div className="review-section-header">
                <span className="review-section-title">Boarding Passes ({allPasses.length})</span>
              </div>
            )}
            {allPasses.map(job => (
              <BoardingPassCard
                key={job.id}
                job={job}
                onToast={onToast}
                onOpenDetail={setDetailJob}
                onDelete={(id) => { removeBoarded(id); onToast?.('Removed from boarding passes') }}
                onAdvanceStatus={(id, status) => { updateBoardedStatus(id, status); onToast?.(`Status updated to ${STATUS_META[status]?.label}`) }}
              />
            ))}

            {savedJobs.length > 0 && (
              <>
                <div className="review-section-header">
                  <span className="review-section-title">Saved ({savedJobs.length})</span>
                </div>
                {savedJobs.map(job => (
                  <SavedCard key={job.id} job={job}
                    onBoard={(j) => { removeSaved(j.id); boardJob(j); onToast?.(`${j.company} moved to boarding passes`) }}
                    onRemove={(id) => { removeSaved(id); onToast?.('Removed') }}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      <JobDetail
        job={detailJob}
        open={!!detailJob}
        onClose={() => setDetailJob(null)}
        onApply={() => { onToast?.(`Applied to ${detailJob?.company}`); setDetailJob(null) }}
        onSave={() => { onToast?.(`Saved ${detailJob?.company}`); setDetailJob(null) }}
        onOpenTailor={() => onToast?.('Opening resume tailor...')}
        onOpenCoach={() => onToast?.('Opening interview coach...')}
      />
    </div>
  )
}
