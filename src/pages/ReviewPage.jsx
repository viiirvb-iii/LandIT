import { useRef, useEffect, useMemo, useState } from 'react'
import { useJobActions } from '../context/JobActionsContext'
import JobDetail from '../components/JobDetail'
import CompanyAvatar from '../components/CompanyAvatar'
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
  landed:     '#16a34a',
  inflight:   '#d97706',
  uploaded:   '#2563eb',
  downloaded: '#7c3aed',
  departed:   '#dc2626',
  saved:      '#2563eb',
}

/* ── Earth Globe Radar ── */

/* Simplified continent outlines in [longitude, latitude] degrees */
const CONTINENTS = [
  { pts: [[-17,15],[-8,30],[5,37],[18,33],[35,25],[43,10],[50,-2],[42,-12],[30,-30],[18,-35],[12,-28],[10,-5],[-5,5]], fill: '#1a6b3c' },
  { pts: [[-10,36],[0,43],[5,48],[15,55],[25,60],[32,55],[28,45],[22,38],[10,36],[-5,38]], fill: '#1f7a45' },
  { pts: [[30,42],[40,52],[55,55],[70,60],[90,62],[110,55],[125,48],[135,38],[130,22],[115,25],[95,30],[75,35],[55,38],[40,38]], fill: '#1a6b3c' },
  { pts: [[-160,62],[-140,68],[-120,58],[-105,55],[-85,48],[-78,38],[-82,28],[-95,22],[-105,28],[-115,33],[-125,48],[-145,58]], fill: '#1f7a45' },
  { pts: [[-82,10],[-73,5],[-58,-8],[-48,-18],[-48,-28],[-55,-38],[-68,-52],[-73,-48],[-78,-22],[-82,-5]], fill: '#1a6b3c' },
  { pts: [[115,-14],[125,-13],[138,-15],[150,-23],[152,-30],[145,-37],[132,-35],[118,-28],[114,-20]], fill: '#b87a3a' },
]
const GRID_LATS = [-60, -30, 0, 30, 60]
const GRID_LONS = Array.from({ length: 12 }, (_, i) => i * 30)

function project(lonDeg, latDeg, rotation, cx, cy, R) {
  const lon = (lonDeg * Math.PI) / 180 + rotation
  const lat = (latDeg * Math.PI) / 180
  const x = Math.cos(lat) * Math.sin(lon)
  const y = -Math.sin(lat)
  const z = Math.cos(lat) * Math.cos(lon)
  return { x: cx + x * R, y: cy + y * R, z }
}

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
    const H = 320
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = '100%'
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    const cx = W / 2, cy = H / 2
    const R = Math.min(W, H) * 0.38

    /* stars */
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.3 + Math.random() * 1.4, phase: Math.random() * Math.PI * 2,
    }))

    /* place job nodes in orbit */
    const placed = allNodes.map((n, i) => {
      const total = Math.max(allNodes.length, 1)
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2
      const dist = R + 30 + (i % 3) * 14
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        letter: n.logo || n.company?.[0] || '?',
        color: n.color || '#94a3b8',
        statusColor: n.kind === 'saved' ? STATUS_COLORS.saved : (STATUS_COLORS[n.status] || STATUS_COLORS.inflight),
        phase: Math.random() * Math.PI * 2,
        kind: n.kind,
      }
    })

    let t = 0
    function draw() {
      t += 0.004
      ctx.clearRect(0, 0, W, H)

      /* ── Space background ── */
      ctx.fillStyle = '#050a18'
      ctx.fillRect(0, 0, W, H)

      /* twinkling stars */
      stars.forEach(s => {
        const a = 0.25 + 0.45 * Math.sin(t * 2.5 + s.phase)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,220,255,${a})`
        ctx.fill()
      })

      /* ── Atmospheric glow ── */
      const atmoGrd = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.35)
      atmoGrd.addColorStop(0, 'rgba(80,160,255,0.18)')
      atmoGrd.addColorStop(0.5, 'rgba(60,140,255,0.07)')
      atmoGrd.addColorStop(1, 'rgba(40,120,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2)
      ctx.fillStyle = atmoGrd
      ctx.fill()

      /* ── Ocean sphere ── */
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      const oceanGrd = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx + R * 0.2, cy + R * 0.2, R)
      oceanGrd.addColorStop(0, '#1a5090')
      oceanGrd.addColorStop(0.5, '#0d3a6e')
      oceanGrd.addColorStop(1, '#082040')
      ctx.fillStyle = oceanGrd
      ctx.fill()

      /* globe outline */
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(80,160,255,0.30)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      /* ── Grid + continents (clipped to globe) ── */
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      const rotation = t * 0.3

      /* latitude lines */
      GRID_LATS.forEach(lat => {
        ctx.beginPath()
        let started = false
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(lon, lat, rotation, cx, cy, R)
          if (p.z > -0.1) {
            if (!started) { ctx.moveTo(p.x, p.y); started = true }
            else ctx.lineTo(p.x, p.y)
          } else started = false
        }
        ctx.strokeStyle = 'rgba(80,160,255,0.10)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      /* longitude lines */
      GRID_LONS.forEach(lon => {
        ctx.beginPath()
        let started = false
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(lon, lat, rotation, cx, cy, R)
          if (p.z > -0.1) {
            if (!started) { ctx.moveTo(p.x, p.y); started = true }
            else ctx.lineTo(p.x, p.y)
          } else started = false
        }
        ctx.strokeStyle = 'rgba(80,160,255,0.07)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      })

      /* ── Continents (3D projected) ── */
      CONTINENTS.forEach(cont => {
        const projected = cont.pts.map(([lon, lat]) => project(lon, lat, rotation, cx, cy, R))
        const visible = projected.filter(p => p.z > 0)
        if (visible.length < 3) return

        ctx.beginPath()
        let started = false
        projected.forEach(p => {
          if (p.z > -0.05) {
            if (!started) { ctx.moveTo(p.x, p.y); started = true }
            else ctx.lineTo(p.x, p.y)
          }
        })
        ctx.closePath()

        const avgZ = visible.reduce((s, p) => s + p.z, 0) / visible.length
        ctx.globalAlpha = (0.5 + avgZ * 0.5) * 0.85
        ctx.fillStyle = cont.fill
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      ctx.restore()

      /* ── Specular highlight ── */
      const specGrd = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, 0, cx - R * 0.35, cy - R * 0.35, R * 0.6)
      specGrd.addColorStop(0, 'rgba(255,255,255,0.10)')
      specGrd.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = specGrd
      ctx.fill()

      /* ── Radar sweep ── */
      const sweepAngle = t * 1.2

      /* sweep glow trail */
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, sweepAngle - 0.5, sweepAngle, false)
      ctx.closePath()
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      sg.addColorStop(0, 'rgba(0,255,136,0.0)')
      sg.addColorStop(0.4, 'rgba(0,255,136,0.05)')
      sg.addColorStop(1, 'rgba(0,255,136,0.12)')
      ctx.fillStyle = sg
      ctx.fill()

      /* sweep line */
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R)
      ctx.strokeStyle = 'rgba(0,255,136,0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      /* ── Center hub ── */
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#00ff88'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, 7, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,255,136,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()

      /* pulse */
      const pulseR = 7 + (1 + Math.sin(t * 3)) * 5
      ctx.beginPath()
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0,255,136,${0.3 - (pulseR - 7) * 0.025})`
      ctx.lineWidth = 1
      ctx.stroke()

      /* label */
      ctx.font = '600 8px -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(0,255,136,0.7)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('YOU', cx, cy + 14)

      /* ── Connection lines + job nodes ── */
      placed.forEach(n => {
        const wobX = Math.sin(t + n.phase) * 2.5
        const wobY = Math.cos(t * 0.7 + n.phase) * 2.5
        const nx = n.x + wobX, ny = n.y + wobY

        /* curved connection */
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        const cpx = (cx + nx) / 2 + (ny - cy) * 0.15
        const cpy = (cy + ny) / 2 - (nx - cx) * 0.15
        ctx.quadraticCurveTo(cpx, cpy, nx, ny)
        const lineAlpha = 0.15 + 0.08 * Math.sin(t * 1.5 + n.phase)
        ctx.strokeStyle = n.kind === 'saved'
          ? `rgba(80,160,255,${lineAlpha})`
          : `rgba(0,255,136,${lineAlpha})`
        ctx.lineWidth = 0.8
        ctx.setLineDash(n.kind === 'saved' ? [3, 3] : [])
        ctx.stroke()
        ctx.setLineDash([])

        /* node glow */
        const glowGrd = ctx.createRadialGradient(nx, ny, 0, nx, ny, 14)
        glowGrd.addColorStop(0, n.statusColor + '30')
        glowGrd.addColorStop(1, n.statusColor + '00')
        ctx.fillStyle = glowGrd
        ctx.fillRect(nx - 14, ny - 14, 28, 28)

        /* node dot */
        ctx.beginPath()
        ctx.arc(nx, ny, 5, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()

        /* status ring */
        ctx.beginPath()
        ctx.arc(nx, ny, 7.5, 0, Math.PI * 2)
        ctx.strokeStyle = n.statusColor
        ctx.lineWidth = 1.5
        ctx.stroke()
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
        <CompanyAvatar logoUrl={job.logoUrl} company={job.company} color={job.color} size={44} radius={12} />
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

      {/* Job summary — always on top of skills */}
      <div className="review-card-desc">{job.desc || job.role}</div>

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
      <CompanyAvatar logoUrl={job.logoUrl} company={job.company} color={job.color} size={44} radius={12} />
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
        onOpenCoach={() => onToast?.('Opening interview coach...')}
      />
    </div>
  )
}
