import React from "react";
import { useNavigate } from "react-router-dom";
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
        <circle key={cx} cx={cx} cy="6" r="5" fill="#0f1320" />
      ))}
    </svg>
  );
}

export default function Passport({ open, onClose, data }) {
  const navigate = useNavigate();
  if (!data) return null;

  const {
    name, country, from, to, flight, gate,
    class: seatClass, season, degree, university,
    year, resumeUpdated, searching, locations,
    fields, swipedToday, tailorsLeft, stamps = [],
  } = data;

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="passport-header-icon">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/>
          </svg>
          <span className="passport-header-title">Passport</span>
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

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}