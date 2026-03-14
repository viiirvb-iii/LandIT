import { useJobActions } from '../context/JobActionsContext'
import { USER_SKILLS, SKILL_GAPS, SUGGESTED_COMPANIES } from '../data/jobs'
import './WishlistPage.css'

const TAG_LABELS = { strong: 'Strong', ok: 'Developing', gap: 'Gap' }

export default function WishlistPage({ onToast }) {
  const { savedJobs, removeSaved, boardJob } = useJobActions()

  const handleBoard = (job) => {
    removeSaved(job.id)
    boardJob(job)
    onToast?.(`${job.company} moved to boarding passes`)
  }

  return (
    <div className="wishlist-page">

      {/* ── Saved Jobs ── */}
      {savedJobs.length > 0 && (
        <>
          <h2 className="wishlist-section-title">Saved jobs ({savedJobs.length})</h2>
          <div className="saved-jobs-list">
            {savedJobs.map(job => (
              <div className="saved-job-card" key={job.id}>
                <div className="saved-job-logo" style={{ background: job.color }}>
                  {job.logoUrl
                    ? <img src={job.logoUrl} alt={job.company} style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = job.logo }} />
                    : job.logo}
                </div>
                <div className="saved-job-info">
                  <div className="saved-job-role">{job.role}</div>
                  <div className="saved-job-company">{job.company} · {job.location}</div>
                </div>
                <div className="saved-job-actions">
                  <button className="saved-job-btn board" onClick={() => handleBoard(job)}>Board</button>
                  <button className="saved-job-btn remove" onClick={() => { removeSaved(job.id); onToast?.('Removed') }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <hr className="wishlist-divider" />
        </>
      )}

      {/* ── Skill Radar ── */}
      <h2 className="wishlist-section-title">Skill radar</h2>
      <div className="skill-radar-card">
        {USER_SKILLS.map((s) => (
          <div className="skill-bar-row" key={s.name}>
            <span className="skill-bar-name">{s.name}</span>
            <div className="skill-bar-track">
              <div className={`skill-bar-fill ${s.tag}`} style={{ width: `${s.level}%` }} />
            </div>
            <span className={`skill-tag-pill ${s.tag}`}>{TAG_LABELS[s.tag]}</span>
          </div>
        ))}
      </div>

      {/* ── Skill Gaps ── */}
      <div className="gap-section">
        <p className="gap-section-title">Missing from your applications</p>
        <div className="gap-chips">
          {SKILL_GAPS.map((g) => (
            <span className="gap-chip" key={g.name}>{g.name}<span className="gap-chip-freq">&times;{g.freq}</span></span>
          ))}
        </div>
      </div>

      <hr className="wishlist-divider" />

      {/* ── Company Suggestions ── */}
      <h2 className="wishlist-section-title">Destinations to explore</h2>
      <div className="company-cards">
        {SUGGESTED_COMPANIES.map((c) => (
          <div className="company-card" key={c.name}>
            <div className="company-card-hero" style={{ background: c.gradient }}>
              <div className="company-card-logo" style={{ color: c.logoColor }}>{c.logo}</div>
            </div>
            <div className="company-card-body">
              <h3 className="company-card-name">{c.name}</h3>
              <p className="company-card-sector">{c.sector}</p>
              <p className="company-card-desc">{c.desc}</p>
              <div className="company-card-roles">
                {c.roles.map((r) => (<span className="company-role-pill" key={r}>{r}</span>))}
              </div>
              <div className="company-card-actions">
                <button className="company-btn primary" onClick={() => onToast?.(`${c.name} added to watchlist`)}>Add to watchlist</button>
                <button className="company-btn outline" onClick={() => onToast?.(`${c.name} skipped`)}>Skip</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
