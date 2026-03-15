import React from "react";
import "./JobDetail.css";
import CompanyAvatar from "./CompanyAvatar";

/* ── tiny helpers ─────────────────────────── */

/** Parse a description string into an array of bullet-point strings */
const parseBullets = (text) => {
  if (!text) return [];
  // strip HTML tags but keep newlines from <br>, <li>, <p>
  let cleaned = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  // split on newlines, bullet chars, or numbered lists
  let lines = cleaned.split(/\n|(?:^|\n)\s*[\u2022\u2023\u25E6\u2043\u25AA•●◦-]\s*|(?:^|\n)\s*\d+[.)]\s*/);
  lines = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 8); // skip tiny fragments

  // if we only got one big blob, split by sentences
  if (lines.length <= 1 && cleaned.length > 60) {
    lines = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
  }

  return lines.length > 0 ? lines : [text];
};

const docIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes("resume") || n.includes("cv")) return "\u{1F4C4}";
  if (n.includes("cover")) return "\u{2709}\uFE0F";
  if (n.includes("portfolio")) return "\u{1F4BC}";
  if (n.includes("transcript")) return "\u{1F4DC}";
  if (n.includes("reference")) return "\u{1F465}";
  return "\u{1F4CE}";
};

const statusClass = (s) => {
  if (!s) return "required";
  const l = s.toLowerCase();
  if (l === "ready" || l === "done" || l === "uploaded") return "ready";
  if (l.includes("ai") || l.includes("draft")) return "ai-draft";
  return "required";
};

const statusLabel = (s) => {
  if (!s) return "Required";
  const l = s.toLowerCase();
  if (l === "ready" || l === "done" || l === "uploaded") return "Ready";
  if (l.includes("ai") || l.includes("draft")) return "AI Draft";
  return "Required";
};

const timelineDotColor = (idx, total) => {
  if (idx === 0) return "blue";
  if (idx < total - 1) return "green";
  return "gray";
};

/* ── component ────────────────────────────── */

export default function JobDetail({
  job,
  open,
  onClose,
  onApply,
  onSave,
  onOpenCoach,
  onOpenCoverLetter,
}) {
  if (!job) return null;

  const {
    role,
    company,
    location,
    salary,
    match,
    deadline,
    duration,
    about,
    reqs,
    skills,
    docs,
    timeline,
    companyAbout,
    logo,
    logoUrl,
    color,
    g,
  } = job;

  const gradient = g || color || "#3b82f6";
  const aboutBullets = parseBullets(about);

  return (
    <div className={`jd-overlay${open ? " open" : ""}`}>
      {/* ---- Hero ---- */}
      <div className="jd-hero">
        <div
          className="jd-hero-gradient"
          style={{
            background:
              typeof gradient === "string" && gradient.includes("gradient")
                ? gradient
                : `linear-gradient(135deg, ${gradient}, ${gradient}88)`,
          }}
        />

        <button className="jd-back-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <p className="jd-eyebrow">Job Details</p>
        <h1 className="jd-role-title">{role}</h1>

        <div className="jd-company-badge">
          <CompanyAvatar logoUrl={logoUrl} company={company} color={color} size={48} radius={12} />
          <div className="jd-company-info">
            <span className="jd-company-name">{company}</span>
            <span className="jd-company-loc">{location}</span>
          </div>
        </div>
      </div>

      {/* ---- Quick Stats ---- */}
      <div className="jd-stats">
        <div className="jd-stat-card">
          <div className="jd-stat-icon">{"\u{1F4B0}"}</div>
          <div className="jd-stat-value">{salary || "N/A"}</div>
          <div className="jd-stat-label">Pay</div>
        </div>
        <div className="jd-stat-card">
          <div className="jd-stat-icon">{"\u{1F3AF}"}</div>
          <div className="jd-stat-value">{match != null ? `${match}%` : "—"}</div>
          <div className="jd-stat-label">Match</div>
        </div>
        <div className="jd-stat-card">
          <div className="jd-stat-icon">{"\u{23F3}"}</div>
          <div className="jd-stat-value">{deadline || "—"}</div>
          <div className="jd-stat-label">Closes</div>
        </div>
        <div className="jd-stat-card">
          <div className="jd-stat-icon">{"\u{1F4C5}"}</div>
          <div className="jd-stat-value">{duration || "—"}</div>
          <div className="jd-stat-label">Duration</div>
        </div>
      </div>

      {/* ---- AI Actions ---- */}
      <div className="jd-ai-actions">
        <button className="jd-ai-action" onClick={() => window.open(job.url || `https://www.linkedin.com/company/${encodeURIComponent(company)}`, '_blank')}>
          Company
        </button>
        <button className="jd-ai-action" onClick={onOpenCoach}>
          AI Coach
        </button>
        <button className="jd-ai-action" onClick={onOpenCoverLetter}>
          Cover Letter
        </button>
      </div>

      {/* ---- Sections ---- */}
      <div className="jd-sections">
        {/* About the role */}
        {about && aboutBullets.length > 0 && (
          <div className="jd-section">
            <div className="jd-section-header">
              <span className="jd-section-title">About the role</span>
            </div>
            <ul className="jd-about-bullets">
              {aboutBullets.map((bullet, i) => (
                <li key={i} className="jd-about-bullet">{bullet}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Requirements */}
        {reqs && reqs.length > 0 && (
          <div className="jd-section">
            <div className="jd-section-header">
              <span className="jd-section-title">Requirements</span>
            </div>
            <ul className="jd-reqs-list">
              {reqs.map((r, i) => {
                const met = typeof r === "object" ? r.met : true;
                const text = typeof r === "object" ? r.text || r.label : r;
                return (
                  <li key={i} className="jd-req-item">
                    <span className={`jd-req-dot ${met ? "met" : "unmet"}`} />
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Skill Match */}
        {skills && skills.length > 0 && (
          <div className="jd-section">
            <div className="jd-section-header">
              <span className="jd-section-title">Your skill match</span>
            </div>
            <div className="jd-skills-wrap">
              {skills.map((s, i) => {
                const label = typeof s === "object" ? s.name || s.label : s;
                const level = typeof s === "object" ? (s.level || s.status || "have") : "have";
                const cls =
                  level === "have" || level === "strong"
                    ? "have"
                    : level === "ok" || level === "learning" || level === "medium"
                    ? "ok"
                    : "miss";
                return (
                  <span key={i} className={`jd-skill-chip ${cls}`}>
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents */}
        {docs && docs.length > 0 && (
          <div className="jd-section">
            <div className="jd-section-header">
              <span className="jd-section-title">Documents required</span>
            </div>
            <div className="jd-docs-list">
              {docs.map((d, i) => {
                const name = typeof d === "object" ? d.name || d.label : d;
                const status = typeof d === "object" ? d.status : null;
                return (
                  <div key={i} className="jd-doc-card">
                    <div className="jd-doc-left">
                      <span className="jd-doc-icon">{docIcon(name)}</span>
                      <span className="jd-doc-name">{name}</span>
                    </div>
                    <span className={`jd-doc-badge ${statusClass(status)}`}>
                      {statusLabel(status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline && timeline.length > 0 && (
          <div className="jd-section">
            <div className="jd-section-header">
              <span className="jd-section-title">Timeline</span>
            </div>
            <div className="jd-timeline">
              {timeline.map((t, i) => {
                const label = typeof t === "object" ? t.label || t.step : t;
                const date = typeof t === "object" ? t.date : null;
                const dotColor = typeof t === "object" && t.color
                  ? t.color
                  : timelineDotColor(i, timeline.length);
                return (
                  <div key={i} className="jd-timeline-item">
                    <span className={`jd-timeline-dot ${dotColor}`} />
                    <div className="jd-timeline-content">
                      <span className="jd-timeline-label">{label}</span>
                      {date && <span className="jd-timeline-date">{date}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* About the company */}
        {companyAbout && (
          <div className="jd-section">
            <div className="jd-section-header">
              <span className="jd-section-title">About {company}</span>
            </div>
            <div className="jd-section-body">{companyAbout}</div>
          </div>
        )}
      </div>

      {/* ---- CTA Footer — always at the end ---- */}
      <div className="jd-cta">
        <div className="jd-cta-inner">
          <button className="jd-btn-apply" onClick={onApply}>
            Land this role
          </button>
          <button className="jd-btn-save" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
