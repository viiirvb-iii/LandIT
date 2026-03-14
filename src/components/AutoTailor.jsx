import { useState, useEffect, useRef } from "react";
import "./AutoTailor.css";

const STEPS = [
  "Parsing resume content",
  "Matching against job description",
  "Optimising keywords & phrasing",
  "Generating tailored version",
];

const ORIGINAL_RESUME = `EXPERIENCE

Software Engineer — Acme Corp
Jan 2022 – Present
• Built internal dashboards using React
• Worked on backend services
• Collaborated with design team on UI

SKILLS
JavaScript, React, Node.js, CSS, HTML
Communication, Team Work`;

const TAILORED_RESUME = `EXPERIENCE

Software Engineer — Acme Corp
Jan 2022 – Present
• Architected and shipped 5 customer-facing dashboards in React, reducing support tickets by 30%
• Designed RESTful APIs powering real-time analytics for 20k+ daily active users
• Led cross-functional sprints with Design & PM, delivering features 2 weeks ahead of schedule

SKILLS
JavaScript, TypeScript, React, Node.js, REST APIs, CI/CD
Agile, Cross-functional Leadership, Technical Communication`;

const SUMMARY_ITEMS = [
  "Replaced vague bullet points with quantified impact statements",
  "Added missing keywords from the job description (TypeScript, REST APIs, CI/CD)",
  "Reframed soft skills to match the listing's leadership requirements",
  "Optimised section ordering to prioritise relevant experience",
];

export default function AutoTailor({ job, open, onClose, onToast }) {
  const [phase, setPhase] = useState("upload"); // upload | processing | results
  const [stepIdx, setStepIdx] = useState(-1);
  const [diffTab, setDiffTab] = useState("tailored");
  const [atsAnimated, setAtsAnimated] = useState(false);
  const fileRef = useRef(null);
  const timers = useRef([]);

  // Reset when overlay opens
  useEffect(() => {
    if (open) {
      setPhase("upload");
      setStepIdx(-1);
      setDiffTab("tailored");
      setAtsAnimated(false);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [open]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const handleUpload = () => {
    setPhase("processing");
    setStepIdx(0);

    STEPS.forEach((_, i) => {
      schedule(() => setStepIdx(i + 1), (i + 1) * 900);
    });

    schedule(() => {
      setPhase("results");
      schedule(() => setAtsAnimated(true), 200);
    }, STEPS.length * 900 + 600);
  };

  const handleExport = () => {
    if (onToast) onToast("Tailored PDF exported");
    onClose();
  };

  const handleRevert = () => {
    clearTimers();
    setPhase("upload");
    setStepIdx(-1);
    setAtsAnimated(false);
  };

  const matchPct = job?.match ?? 91;
  const logoChar = job?.logo ?? job?.company?.[0] ?? "?";
  const bgColor = job?.color ?? "#3b82f6";
  const gradient = job?.g ?? bgColor;

  return (
    <div className={`at-overlay${open ? " at-open" : ""}`}>
      <div className="at-shell">
        {/* ── Header ── */}
        <div className="at-header">
          <div className="at-header-left">
            <div
              className="at-header-logo"
              style={{ background: gradient }}
            >
              {logoChar}
            </div>
            <div className="at-header-meta">
              <h2>AutoTailor</h2>
              <span>
                {job?.role ?? "Role"} at {job?.company ?? "Company"}
              </span>
            </div>
          </div>
          <button className="at-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* ── Upload Phase ── */}
        {phase === "upload" && (
          <div className="at-card">
            <div className="at-upload-zone" onClick={handleUpload}>
              <div className="at-upload-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3>Upload your resume</h3>
              <p>PDF, DOCX or TXT up to 5 MB</p>
              <span className="at-upload-btn">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Choose file
              </span>
            </div>
          </div>
        )}

        {/* ── Processing Phase ── */}
        {phase === "processing" && (
          <div className="at-card">
            <div className="at-processing">
              <div className="at-spinner-ring" />
              <h3>Analysing your resume...</h3>
              <div className="at-steps">
                {STEPS.map((label, i) => {
                  let cls = "at-step";
                  if (i < stepIdx) cls += " at-step-done";
                  else if (i === stepIdx) cls += " at-step-active";
                  return (
                    <div key={i} className={cls}>
                      <span className="at-step-dot" />
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Results Phase ── */}
        {phase === "results" && (
          <>
            <div className="at-card">
              {/* File ready */}
              <div className="at-file-ready">
                <div className="at-file-ready-icon">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="at-file-ready-text">
                  <strong>Resume_Tailored.pdf</strong>
                  <span>Ready to export</span>
                </div>
              </div>

              {/* ATS Score */}
              <div className="at-ats">
                <div className="at-ats-label">ATS Compatibility Score</div>

                <div className="at-ats-row">
                  <span>Before</span>
                  <div className="at-ats-bar-track">
                    <div
                      className="at-ats-bar-fill at-ats-bar-fill-red"
                      style={{ width: atsAnimated ? "54%" : "0%" }}
                    />
                  </div>
                  <span className="at-ats-pct at-ats-pct-red">54%</span>
                </div>

                <div className="at-ats-row">
                  <span>After</span>
                  <div className="at-ats-bar-track">
                    <div
                      className="at-ats-bar-fill at-ats-bar-fill-green"
                      style={{ width: atsAnimated ? `${matchPct}%` : "0%" }}
                    />
                  </div>
                  <span className="at-ats-pct at-ats-pct-green">
                    {matchPct}%
                  </span>
                </div>
              </div>

              {/* Diff viewer */}
              <div className="at-diff">
                <div className="at-diff-tabs">
                  <button
                    className={`at-diff-tab${diffTab === "original" ? " at-diff-tab-active" : ""}`}
                    onClick={() => setDiffTab("original")}
                  >
                    Original
                  </button>
                  <button
                    className={`at-diff-tab${diffTab === "tailored" ? " at-diff-tab-active" : ""}`}
                    onClick={() => setDiffTab("tailored")}
                  >
                    Tailored
                  </button>
                </div>
                <div className="at-diff-body">
                  {diffTab === "original" ? ORIGINAL_RESUME : TAILORED_RESUME}
                </div>
              </div>

              {/* AI Summary */}
              <div className="at-summary">
                <div className="at-summary-title">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  AI Summary &mdash; 4 changes made
                </div>
                <ul>
                  {SUMMARY_ITEMS.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Export buttons */}
              <div className="at-export-row">
                <button
                  className="at-export-btn at-export-primary"
                  onClick={handleExport}
                >
                  Export tailored PDF
                </button>
                <button
                  className="at-export-btn at-export-outline"
                  onClick={handleRevert}
                >
                  Revert
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
