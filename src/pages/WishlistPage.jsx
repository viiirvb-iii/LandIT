import { useState, useEffect } from 'react'
import { useJobActions } from '../context/JobActionsContext'
import { USER_SKILLS as FALLBACK_SKILLS, SKILL_GAPS as FALLBACK_GAPS, LEARNING_COURSES } from '../data/jobs'
import { getUserSkills, getSkillGaps } from '../services/resume'
import './WishlistPage.css'

const TAG_LABELS = { strong: 'Strong', ok: 'Developing', gap: 'Gap' }

const PLATFORM_COLORS = {
  Udemy: '#a435f0',
  Coursera: '#0056d2',
  Codecademy: '#1f4056',
  Confluent: '#171a21',
}

export default function WishlistPage({ onToast }) {
  const { savedJobs, removeSaved, boardJob } = useJobActions()
  const [expandedSkill, setExpandedSkill] = useState(null)
  const [realSkills, setRealSkills] = useState(null)
  const [realGaps, setRealGaps] = useState(null)

  // Fetch real skills from DB (populated by resume parsing)
  useEffect(() => {
    getUserSkills().then((skills) => {
      if (skills.length > 0) setRealSkills(skills)
    })
    getSkillGaps().then((gaps) => {
      if (gaps.length > 0) setRealGaps(gaps)
    })
  }, [])

  const handleBoard = (job) => {
    removeSaved(job.id)
    boardJob(job)
    onToast?.(`${job.company} moved to boarding passes`)
  }

  /* Jobs that have at least one skill with state 'miss' */
  const jobsNeedingSkills = savedJobs.filter(
    (j) => j.skills?.some((s) => s.state === 'miss')
  )

  /* Aggregate gap skill frequency from saved jobs */
  const gapSkillFreq = {}
  savedJobs.forEach((j) => {
    j.skills?.forEach((s) => {
      if (s.state === 'miss') {
        gapSkillFreq[s.name] = (gapSkillFreq[s.name] || 0) + 1
      }
    })
  })
  const sortedGaps = Object.entries(gapSkillFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([name, freq]) => ({ name, freq }))

  /* Use dynamic gaps from saved jobs when available, fall back to DB gaps or static */
  const activeGaps = sortedGaps.length > 0 ? sortedGaps : (realGaps || FALLBACK_GAPS)

  /* Use real skills from resume parsing, fall back to static */
  const displaySkills = realSkills || FALLBACK_SKILLS

  const toggleSkill = (name) =>
    setExpandedSkill((prev) => (prev === name ? null : name))

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
                  {/* Skill gap pills inline */}
                  {job.skills?.some(s => s.state === 'miss') && (
                    <div className="saved-job-gaps">
                      {job.skills.filter(s => s.state === 'miss').map(s => (
                        <span className="saved-job-gap-pill" key={s.name}>{s.name}</span>
                      ))}
                    </div>
                  )}
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

      {/* ── Jobs Needing Skill Improvement ── */}
      {jobsNeedingSkills.length > 0 && (
        <>
          <h2 className="wishlist-section-title">Skills to unlock</h2>
          <p className="wishlist-subtitle">
            {jobsNeedingSkills.length} saved job{jobsNeedingSkills.length > 1 ? 's' : ''} need skill improvement
          </p>
          <div className="skill-unlock-cards">
            {jobsNeedingSkills.slice(0, 5).map(job => {
              const missing = job.skills.filter(s => s.state === 'miss')
              return (
                <div className="skill-unlock-card" key={job.id}>
                  <div className="skill-unlock-header">
                    <div className="saved-job-logo" style={{ background: job.color }}>
                      {job.logo}
                    </div>
                    <div className="skill-unlock-meta">
                      <div className="saved-job-role">{job.role}</div>
                      <div className="saved-job-company">{job.company}</div>
                    </div>
                    <span className="skill-unlock-match">{job.match}%</span>
                  </div>
                  <div className="skill-unlock-missing">
                    <span className="skill-unlock-label">Missing:</span>
                    {missing.map(s => (
                      <button
                        className={`skill-unlock-pill ${expandedSkill === s.name ? 'active' : ''}`}
                        key={s.name}
                        onClick={() => toggleSkill(s.name)}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <hr className="wishlist-divider" />
        </>
      )}

      {/* ── Learn & Level Up ── */}
      <h2 className="wishlist-section-title">Learn & level up</h2>
      <p className="wishlist-subtitle">Courses to close your skill gaps</p>

      <div className="learn-section">
        {activeGaps.map((gap) => {
          const courses = LEARNING_COURSES[gap.name] || []
          if (courses.length === 0) return null
          const isExpanded = expandedSkill === gap.name

          return (
            <div className="learn-skill-group" key={gap.name}>
              <button
                className={`learn-skill-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleSkill(gap.name)}
              >
                <div className="learn-skill-left">
                  <span className="learn-skill-icon">{courses[0]?.icon}</span>
                  <span className="learn-skill-name">{gap.name}</span>
                  <span className="learn-skill-freq">in {gap.freq} job{gap.freq > 1 ? 's' : ''}</span>
                </div>
                <span className="learn-chevron">{isExpanded ? '▾' : '▸'}</span>
              </button>

              {isExpanded && (
                <div className="learn-courses">
                  {courses.map((c) => (
                    <a
                      className="course-card"
                      key={c.title}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="course-platform-badge" style={{ background: PLATFORM_COLORS[c.platform] || '#333' }}>
                        {c.platform}
                      </div>
                      <h4 className="course-title">{c.title}</h4>
                      <p className="course-instructor">{c.instructor}</p>
                      <div className="course-meta">
                        <span className="course-rating">★ {c.rating}</span>
                        <span className="course-dot">·</span>
                        <span className="course-students">{c.students}</span>
                        <span className="course-dot">·</span>
                        <span className="course-duration">{c.duration}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <hr className="wishlist-divider" />

      {/* ── Skill Radar ── */}
      <h2 className="wishlist-section-title">Skill radar</h2>
      <div className="skill-radar-card">
        {displaySkills.map((s) => (
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
          {activeGaps.map((g) => (
            <button
              className={`gap-chip ${expandedSkill === g.name ? 'active' : ''}`}
              key={g.name}
              onClick={() => toggleSkill(g.name)}
            >
              {g.name}<span className="gap-chip-freq">&times;{g.freq}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
