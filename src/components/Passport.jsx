import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { exportResumePdf } from "../services/resume";
import "./Passport.css";

function getStampVariant(stamp) {
  if (!stamp || !stamp.label) return "empty";
  if (stamp.variant) return stamp.variant;
  return "filled";
}

// SVG barcode — deterministic from a seed string
function Barcode({ seed = "LD2026", width = 160, height = 28 }) {
  const bars = [];
  let x = 0;
  const chars = (seed + seed + seed).split("");
  chars.forEach((ch, i) => {
    const code = ch.charCodeAt(0);
    const w = ((code % 3) + 1) * 1.4;
    const gap = ((code % 2) + 1) * 1.2;
    bars.push(
      <rect key={i} x={x} y={0} width={w} height={height} fill="rgba(255,255,255,0.55)" />
    );
    x += w + gap;
    if (x > width) return;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {bars}
    </svg>
  );
}

// Perforated tear line SVG
function TearLine({ color = "rgba(255,255,255,0.12)" }) {
  return (
    <svg width="100%" height="12" viewBox="0 0 300 12" preserveAspectRatio="none" style={{ display: "block", margin: "0 -20px", width: "calc(100% + 40px)" }}>
      <line x1="0" y1="6" x2="300" y2="6" stroke={color} strokeWidth="1" strokeDasharray="4 4" />
      {[0, 40, 80, 120, 160, 200, 240, 280].map(cx => (
        <circle key={cx} cx={cx} cy="6" r="5" fill="#f5ebe0" />
      ))}
    </svg>
  );
}

export default function Passport({ open, onClose, data }) {
  const navigate = useNavigate();
  const [resumeExpanded, setResumeExpanded] = useState(false);
  if (!data) return null;

  const {
    name, country, from, to, flight, gate,
    class: seatClass, season, degree, university,
    year, resumeUpdated, searching, locations,
    fields, swipedToday, tailorsLeft, stamps = [],
    resume,
  } = data;

  const parsed = resume?.parsed_data;

  const handleDownloadResume = async () => {
    const rawText = resume?.raw_text;
    if (!rawText) return;
    await exportResumePdf(rawText, null, null, true);
  };

  const initials = (name || "?")
    .split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const stampSlots = Array.from({ length: 6 }, (_, i) => stamps[i] || null);

  // MRZ lines
  const mrzName = (name || "PASSENGER").toUpperCase().replace(/\s+/g, "<<").padEnd(30, "<");
  const mrzCode = ((flight || "LD2026").replace("-", "") + "AUS" + (year || "26") + "<<<<<<<<<<<<").slice(0, 30);

  return (
    <div className={`passport-overlay${open ? " open" : ""}`}>
      {/* Header */}
      <div className="passport-header">
        <div className="passport-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="passport-header-icon">
            <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none"/>
            <circle cx="12" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M7 18c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <line x1="8" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span className="passport-header-title">Passport</span>
          {name && <span className="passport-header-name">{name}</span>}
        </div>
        <button className="passport-close-btn" onClick={onClose} aria-label="Close passport">×</button>
      </div>

      <div className="passport-content">

        {/* ── PASSPORT BOOKLET ── */}
        <div className="pp-booklet">

          {/* Spine shadow */}
          <div className="pp-spine" />

          {/* PHOTO PAGE */}
          <div className="pp-photo-page">
            {/* Fabric texture overlay */}
            <div className="pp-texture" />

            {/* Top authority bar */}
            <div className="pp-authority-bar">
              <div className="pp-authority-seal">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="13" stroke="rgba(244,223,204,0.5)" strokeWidth="0.8"/>
                  <circle cx="14" cy="14" r="9" stroke="rgba(244,223,204,0.3)" strokeWidth="0.8"/>
                  <path d="M14 5v18M5 14h18M7.5 7.5l13 13M20.5 7.5l-13 13" stroke="rgba(244,223,204,0.2)" strokeWidth="0.6"/>
                  <path d="M19 9v-1.5l-5-3V2.5a1.2 1.2 0 0 0-2.4 0V4.5l-5 3V9l5-1.6V13l-1.5 1v1.5l2.9-.8 2.9.8V14l-1.5-1V7.4L19 9z" fill="rgba(244,223,204,0.7)"/>
                </svg>
              </div>
              <div className="pp-authority-text">
                <div className="pp-authority-country">{country || "AUSTRALIA"}</div>
                <div className="pp-authority-sub">PASSENGER DOCUMENT · LANDIT</div>
              </div>
              <div className="pp-authority-type">P</div>
            </div>

            {/* Photo + name section */}
            <div className="pp-identity-row">
              <div className="pp-photo-frame">
                <div className="pp-photo-inner">
                  <span className="pp-photo-initials">{initials}</span>
                </div>
                <div className="pp-photo-label">PHOTO</div>
              </div>
              <div className="pp-identity-fields">
                <div className="pp-id-field">
                  <div className="pp-id-label">Surname</div>
                  <div className="pp-id-value pp-id-value--lg">
                    {(name || "").split(" ").slice(-1)[0]?.toUpperCase() || "—"}
                  </div>
                </div>
                <div className="pp-id-field">
                  <div className="pp-id-label">Given names</div>
                  <div className="pp-id-value">
                    {(name || "").split(" ").slice(0, -1).join(" ").toUpperCase() || "—"}
                  </div>
                </div>
                <div className="pp-id-field">
                  <div className="pp-id-label">Degree</div>
                  <div className="pp-id-value pp-id-value--sm">{degree || "—"}</div>
                </div>
                <div className="pp-id-field">
                  <div className="pp-id-label">University</div>
                  <div className="pp-id-value pp-id-value--sm">{university || "—"}</div>
                </div>
              </div>
            </div>

            {/* Flight details strip */}
            <div className="pp-flight-strip">
              {[
                { label: "Flight", value: flight || "LD-2026" },
                { label: "From",   value: from   || "MELB" },
                { label: "To",     value: to     || "HIRE" },
                { label: "Gate",   value: gate   || "G7" },
                { label: "Class",  value: seatClass || "GRAD" },
                { label: "Season", value: season || "2026" },
              ].map(({ label, value }) => (
                <div key={label} className="pp-flight-field">
                  <div className="pp-flight-label">{label}</div>
                  <div className="pp-flight-value">{value}</div>
                </div>
              ))}
            </div>

            {/* Tear line */}
            <div className="pp-tear-wrap">
              <TearLine color="rgba(137,72,37,0.2)" />
            </div>

            {/* Barcode + MRZ section */}
            <div className="pp-mrz-section">
              <div className="pp-barcode-row">
                <Barcode seed={flight || "LD2026"} width={180} height={32} />
                <div className="pp-barcode-code">{flight || "LD-2026"}</div>
              </div>
              <div className="pp-mrz-lines">
                <div className="pp-mrz-line">{"P<AUS" + mrzName}</div>
                <div className="pp-mrz-line">{mrzCode}</div>
              </div>
            </div>
          </div>

          {/* VISA STAMPS PAGE */}
          <div className="pp-stamps-page">
            <div className="pp-stamps-page-header">
              <span>APPLICATION STAMPS</span>
              <span className="pp-stamps-page-sub">LANDIT TRAVEL DOCUMENT</span>
            </div>
            <div className="pp-stamps-grid">
              {stampSlots.map((stamp, i) => {
                const variant = getStampVariant(stamp);
                return (
                  <div key={i} className={`pp-stamp pp-stamp--${variant}`}>
                    {stamp ? (
                      <>
                        <div className="pp-stamp-icon">{stamp.icon || "✈"}</div>
                        <div className="pp-stamp-label">{stamp.label}</div>
                        {stamp.awarded_at && (
                          <div className="pp-stamp-date">{stamp.awarded_at}</div>
                        )}
                      </>
                    ) : (
                      <div className="pp-stamp-empty-ring" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Update profile button */}
        <button
          className="passport-update-btn"
          onClick={() => { onClose(); navigate("/onboarding"); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Update Profile
        </button>

        {/* Session card */}
        <div className="pp-info-card">
          <div className="pp-info-card-title">This session</div>
          {[
            { label: "Searching for", value: searching },
            { label: "Locations",     value: Array.isArray(locations) ? locations.join(", ") : locations },
            { label: "Fields",        value: Array.isArray(fields) ? fields.join(", ") : fields },
            { label: "Swiped today",  value: swipedToday },
            { label: "AI tailors left", value: tailorsLeft },
          ].map(({ label, value }) => (
            <div key={label} className="pp-info-row">
              <span className="pp-info-label">{label}</span>
              <span className="pp-info-value">{value || "—"}</span>
            </div>
          ))}
        </div>

        {/* Static profile card */}
        <div className="pp-info-card">
          <div className="pp-info-card-title">Static profile</div>
          {[
            { label: "Degree",      value: degree },
            { label: "University",  value: university },
            { label: "Year",        value: year },
            { label: "Base resume", value: resumeUpdated || "Not uploaded" },
          ].map(({ label, value }) => (
            <div key={label} className="pp-info-row">
              <span className="pp-info-label">{label}</span>
              <span className="pp-info-value">{value || "—"}</span>
            </div>
          ))}
        </div>

        {/* Resume card */}
        {parsed ? (
          <div className="pp-info-card pp-resume-card">
            <div className="pp-info-card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>My Resume</span>
              <button className="pp-resume-toggle" onClick={() => setResumeExpanded(!resumeExpanded)}>
                {resumeExpanded ? "Collapse" : "Expand"}
              </button>
            </div>

            {/* Contact */}
            {parsed.contact && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Contact</div>
                <div className="pp-resume-contact">
                  {parsed.contact.name && <span>{parsed.contact.name}</span>}
                  {parsed.contact.email && <span>{parsed.contact.email}</span>}
                  {parsed.contact.phone && <span>{parsed.contact.phone}</span>}
                  {parsed.contact.location && <span>{parsed.contact.location}</span>}
                  {parsed.contact.linkedin && <span>{parsed.contact.linkedin}</span>}
                </div>
              </div>
            )}

            {/* Summary */}
            {parsed.summary && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Summary</div>
                <p className="pp-resume-text">{parsed.summary}</p>
              </div>
            )}

            {/* Skills */}
            {parsed.skills?.length > 0 && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Skills</div>
                <div className="pp-resume-skills">
                  {parsed.skills.map((s, i) => (
                    <span key={i} className="pp-resume-skill-tag">
                      {typeof s === "string" ? s : s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience — show all if expanded, first 2 otherwise */}
            {parsed.experience?.length > 0 && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Experience</div>
                {(resumeExpanded ? parsed.experience : parsed.experience.slice(0, 2)).map((exp, i) => (
                  <div key={i} className="pp-resume-exp">
                    <div className="pp-resume-exp-header">
                      <strong>{exp.title || exp.role}</strong>
                      {exp.company && <span> at {exp.company}</span>}
                    </div>
                    {(exp.start_date || exp.end_date) && (
                      <div className="pp-resume-exp-dates">
                        {exp.start_date || ""} {exp.end_date ? `— ${exp.end_date}` : ""}
                      </div>
                    )}
                    {exp.bullets?.length > 0 && (
                      <ul className="pp-resume-exp-bullets">
                        {(resumeExpanded ? exp.bullets : exp.bullets.slice(0, 2)).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                        {!resumeExpanded && exp.bullets.length > 2 && (
                          <li className="pp-resume-more">+{exp.bullets.length - 2} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                ))}
                {!resumeExpanded && parsed.experience.length > 2 && (
                  <div className="pp-resume-more-hint">
                    +{parsed.experience.length - 2} more positions
                  </div>
                )}
              </div>
            )}

            {/* Education */}
            {parsed.education?.length > 0 && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Education</div>
                {parsed.education.map((edu, i) => (
                  <div key={i} className="pp-resume-exp">
                    <div className="pp-resume-exp-header">
                      <strong>{edu.degree || edu.field}</strong>
                      {edu.institution && <span> — {edu.institution}</span>}
                    </div>
                    {(edu.start_date || edu.end_date || edu.year) && (
                      <div className="pp-resume-exp-dates">
                        {edu.start_date || edu.year || ""} {edu.end_date ? `— ${edu.end_date}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Projects — only when expanded */}
            {resumeExpanded && parsed.projects?.length > 0 && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Projects</div>
                {parsed.projects.map((proj, i) => (
                  <div key={i} className="pp-resume-exp">
                    <div className="pp-resume-exp-header">
                      <strong>{proj.name || proj.title}</strong>
                    </div>
                    {proj.description && <p className="pp-resume-text">{proj.description}</p>}
                    {proj.technologies?.length > 0 && (
                      <div className="pp-resume-skills" style={{ marginTop: 4 }}>
                        {proj.technologies.map((t, j) => (
                          <span key={j} className="pp-resume-skill-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Certifications — only when expanded */}
            {resumeExpanded && parsed.certifications?.length > 0 && (
              <div className="pp-resume-section">
                <div className="pp-resume-section-title">Certifications</div>
                {parsed.certifications.map((cert, i) => (
                  <div key={i} className="pp-resume-exp">
                    <div className="pp-resume-exp-header">
                      <strong>{typeof cert === "string" ? cert : cert.name || cert.title}</strong>
                      {cert.issuer && <span> — {cert.issuer}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Download button */}
            <button className="pp-resume-download-btn" onClick={handleDownloadResume}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Resume PDF
            </button>
          </div>
        ) : (
          <div className="pp-info-card">
            <div className="pp-info-card-title">My Resume</div>
            <div className="pp-resume-empty">
              <p>No resume uploaded yet. Upload one from the swipe screen to see it here.</p>
            </div>
          </div>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}