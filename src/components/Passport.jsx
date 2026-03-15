import React from "react";
import "./Passport.css";

function getStampVariant(stamp) {
  if (!stamp || !stamp.label) return "empty";
  if (stamp.variant) return stamp.variant;
  return "filled";
}

export default function Passport({ open, onClose, data }) {
  if (!data) return null;

  const {
    name,
    email,
    phone,
    location,
    country,
    from,
    to,
    flight,
    gate,
    class: seatClass,
    season,
    degree,
    university,
    year,
    resumeUpdated,
    resumeSkills = [],
    resumeSummary,
    resumeExperience = [],
    resumeEducation = [],
    resumeProjects = [],
    careerLevel,
    searching,
    locations,
    fields,
    swipedToday,
    tailorsLeft,
    stamps = [],
  } = data;

  const stampSlots = Array.from({ length: 6 }, (_, i) => stamps[i] || null);

  return (
    <div className={`passport-overlay${open ? " open" : ""}`}>
      {/* Header */}
      <div className="passport-header">
        <span className="passport-header-title">Passport</span>
        <button
          className="passport-close-btn"
          onClick={onClose}
          aria-label="Close passport"
        >
          &times;
        </button>
      </div>

      {/* Scrollable content */}
      <div className="passport-content">
        {/* ===== Boarding Pass Cover ===== */}
        <div className="passport-cover">
          <div className="passport-cover-label">
            landed &middot; boarding pass
          </div>
          <div className="passport-cover-country">{country}</div>
          <div className="passport-cover-name">{name}</div>
          {email && <div className="passport-cover-email">{email}</div>}

          <div className="passport-cover-route">
            <span className="passport-cover-route-city">{from}</span>
            <svg
              className="passport-cover-route-arrow"
              width="28"
              height="12"
              viewBox="0 0 28 12"
              fill="none"
            >
              <path
                d="M2 6h22m0 0l-5-5m5 5l-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="passport-cover-route-city">{to}</span>
          </div>

          <div className="passport-cover-fields">
            <div>
              <div className="passport-cover-field-label">Flight</div>
              <div className="passport-cover-field-value">{flight}</div>
            </div>
            <div>
              <div className="passport-cover-field-label">Gate</div>
              <div className="passport-cover-field-value">{gate}</div>
            </div>
            <div>
              <div className="passport-cover-field-label">Class</div>
              <div className="passport-cover-field-value">{seatClass}</div>
            </div>
            <div>
              <div className="passport-cover-field-label">Season</div>
              <div className="passport-cover-field-value">{season}</div>
            </div>
          </div>

          {/* Personal details row */}
          <div className="passport-cover-details">
            {phone && (
              <div className="passport-cover-detail">
                <span className="passport-cover-detail-label">Phone</span>
                <span className="passport-cover-detail-value">{phone}</span>
              </div>
            )}
            {location && (
              <div className="passport-cover-detail">
                <span className="passport-cover-detail-label">Location</span>
                <span className="passport-cover-detail-value">{location}</span>
              </div>
            )}
            {careerLevel && (
              <div className="passport-cover-detail">
                <span className="passport-cover-detail-label">Level</span>
                <span className="passport-cover-detail-value passport-level-badge">{careerLevel}</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== Profile Card ===== */}
        <div className="passport-card">
          <div className="passport-card-title">Profile</div>
          <div className="passport-info-row">
            <span className="passport-info-label">Degree</span>
            <span className="passport-info-value">{degree || "—"}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">University</span>
            <span className="passport-info-value">{university || "—"}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Year</span>
            <span className="passport-info-value">{year || "—"}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Searching</span>
            <span className="passport-info-value">{searching}</span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Locations</span>
            <span className="passport-info-value">
              {Array.isArray(locations) ? locations.join(", ") : locations}
            </span>
          </div>
          <div className="passport-info-row">
            <span className="passport-info-label">Fields</span>
            <span className="passport-info-value">
              {Array.isArray(fields) ? fields.join(", ") : fields}
            </span>
          </div>
        </div>

        {/* ===== Resume Section ===== */}
        <div className="passport-card">
          <div className="passport-card-title">
            Resume
            <span className="passport-resume-status">{resumeUpdated}</span>
          </div>

          {/* Summary */}
          {resumeSummary && (
            <div className="passport-resume-summary">{resumeSummary}</div>
          )}

          {/* Skills */}
          {resumeSkills.length > 0 && (
            <>
              <div className="passport-resume-section-label">Skills</div>
              <div className="passport-skills-grid">
                {resumeSkills.slice(0, 15).map((skill, i) => (
                  <span key={i} className="passport-skill-chip">{skill}</span>
                ))}
                {resumeSkills.length > 15 && (
                  <span className="passport-skill-chip passport-skill-more">
                    +{resumeSkills.length - 15}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Experience */}
          {resumeExperience.length > 0 && (
            <>
              <div className="passport-resume-section-label">Experience</div>
              {resumeExperience.slice(0, 4).map((exp, i) => (
                <div key={i} className="passport-exp-item">
                  <div className="passport-exp-title">{exp.title}</div>
                  <div className="passport-exp-company">
                    {exp.company}
                    {exp.start_date && (
                      <span className="passport-exp-date">
                        {exp.start_date} — {exp.end_date || "Present"}
                      </span>
                    )}
                  </div>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="passport-exp-bullets">
                      {exp.bullets.slice(0, 2).map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Education */}
          {resumeEducation.length > 0 && (
            <>
              <div className="passport-resume-section-label">Education</div>
              {resumeEducation.map((edu, i) => (
                <div key={i} className="passport-edu-item">
                  <div className="passport-edu-degree">{edu.degree}</div>
                  <div className="passport-edu-school">
                    {edu.institution}
                    {edu.year && <span className="passport-edu-year">{edu.year}</span>}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Projects */}
          {resumeProjects.length > 0 && (
            <>
              <div className="passport-resume-section-label">Projects</div>
              {resumeProjects.slice(0, 3).map((proj, i) => (
                <div key={i} className="passport-proj-item">
                  <div className="passport-proj-name">{proj.name}</div>
                  {proj.description && (
                    <div className="passport-proj-desc">{proj.description}</div>
                  )}
                  {proj.technologies && proj.technologies.length > 0 && (
                    <div className="passport-proj-tech">
                      {proj.technologies.join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* No resume state */}
          {!resumeSummary && resumeSkills.length === 0 && resumeExperience.length === 0 && (
            <div className="passport-resume-empty">
              No resume uploaded yet. Upload one during onboarding or via AI Coach.
            </div>
          )}
        </div>

        {/* ===== Session Stats ===== */}
        <div className="passport-card">
          <div className="passport-card-title">Session</div>
          <div className="passport-stats-row">
            <div className="passport-stat">
              <span className="passport-stat-num">{swipedToday}</span>
              <span className="passport-stat-label">Swiped today</span>
            </div>
            <div className="passport-stat">
              <span className="passport-stat-num">{tailorsLeft}</span>
              <span className="passport-stat-label">AI tailors left</span>
            </div>
            <div className="passport-stat">
              <span className="passport-stat-num">{resumeSkills.length}</span>
              <span className="passport-stat-label">Skills found</span>
            </div>
          </div>
        </div>

        {/* ===== Application Stamps ===== */}
        <div className="passport-card">
          <div className="passport-card-title">Application stamps</div>
          <div className="passport-stamps-grid">
            {stampSlots.map((stamp, i) => {
              const variant = getStampVariant(stamp);
              return (
                <div key={i} className={`passport-stamp passport-stamp--${variant}`}>
                  {stamp ? stamp.label : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
