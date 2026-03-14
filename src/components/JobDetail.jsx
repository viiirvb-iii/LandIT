import React from "react";
import "./JobDetail.css";

/* ── tiny helpers ─────────────────────────── */

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
  onOpenTailor,
  onOpenCoach,
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
    color,
    g,
  } = job;

  const gradient = g || color || "#3b82f6";

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
          <div className="jd-company-logo" style={{ background: color || "#3b82f6" }}>
            {logo || company?.charAt(0) || "?"}
          </div>
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
        <button className="jd-ai-action" onClick={onOpenTailor}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Tailor Resume
        </button>
        <button className="jd-ai-action" onClick={onOpenCoach}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Interview Coach
        </button>
      </div>

      {/* ---- Sections ---- */}
      <div className="jd-sections">
        {/* About the role */}
        {about && (
          <div className="jd-section">
            <div className="jd-section-header">
              <div className="jd-section-icon blue">{"\u{1F4CB}"}</div>
              <span className="jd-section-title">About the role</span>
            </div>
            <div className="jd-section-body">{about}</div>
          </div>
        )}

        {/* Requirements */}
        {reqs && reqs.length > 0 && (
          <div className="jd-section">
            <div className="jd-section-header">
              <div className="jd-section-icon green">{"\u2705"}</div>
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
              <div className="jd-section-icon amber">{"\u{1F9E9}"}</div>
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
              <div className="jd-section-icon purple">{"\u{1F4C2}"}</div>
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
              <div className="jd-section-icon gray">{"\u{1F552}"}</div>
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
              <div className="jd-section-icon blue">{"\u{1F3E2}"}</div>
              <span className="jd-section-title">About {company}</span>
            </div>
            <div className="jd-section-body">{companyAbout}</div>
          </div>
        )}
      </div>

      {/* ---- CTA Footer ---- */}
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
