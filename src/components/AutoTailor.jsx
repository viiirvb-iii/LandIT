import { useState, useEffect, useRef } from "react";
import { uploadAndParseResume, tailorResume, exportResumePdf } from "../services/resume";
import "./AutoTailor.css";

const STEPS = [
  "Parsing resume content",
  "Matching against job description",
  "Optimising keywords & phrasing",
  "Generating tailored version",
];

export default function AutoTailor({ job, open, onClose, onToast }) {
  const [phase, setPhase] = useState("upload"); // upload | processing | results | error
  const [stepIdx, setStepIdx] = useState(-1);
  const [diffTab, setDiffTab] = useState("tailored");
  const [atsAnimated, setAtsAnimated] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const timers = useRef([]);

  // Result data from the RAG pipeline
  const [originalText, setOriginalText] = useState("");
  const [tailoredText, setTailoredText] = useState("");
  const [summaryItems, setSummaryItems] = useState([]);
  const [atsBefore, setAtsBefore] = useState(0);
  const [atsAfter, setAtsAfter] = useState(0);
  const [honestGaps, setHonestGaps] = useState([]);

  // Reset when overlay opens
  useEffect(() => {
    if (open) {
      setPhase("upload");
      setStepIdx(-1);
      setDiffTab("tailored");
      setAtsAnimated(false);
      setError("");
      setOriginalText("");
      setTailoredText("");
      setSummaryItems([]);
      setAtsBefore(0);
      setAtsAfter(0);
      setHonestGaps([]);
    }
    return () => timers.current.forEach(clearTimeout);
  }, [open]);

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const handleFileSelect = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    setPhase("processing");
    setStepIdx(0);

    try {
      // Step 1: Parse resume (show steps progressively)
      const stepTimer = setInterval(() => {
        setStepIdx((prev) => {
          if (prev < STEPS.length - 1) return prev + 1;
          clearInterval(stepTimer);
          return prev;
        });
      }, 2000);

      // Upload and parse the resume
      await uploadAndParseResume(file);
      setStepIdx(1);

      // Tailor the resume for this job — pass description so backend can parse the JD
      const result = await tailorResume(job.id, job.about || job.desc || "");
      clearInterval(stepTimer);
      setStepIdx(STEPS.length);

      // Extract results
      const { result: tailorResult, skill_analysis } = result;

      // Build original text from resume sections
      const sections = tailorResult.tailored_sections || [];
      setOriginalText(
        sections.map((s) => `${s.section?.toUpperCase() || ""}\n${s.original}`).join("\n\n")
      );
      setTailoredText(
        sections.map((s) => `${s.section?.toUpperCase() || ""}\n${s.tailored}`).join("\n\n")
      );

      // Build summary items from changes_made
      const changes = tailorResult.changes_made || [];
      setSummaryItems(changes.map((c) => c.what));

      // Set ATS scores
      setAtsBefore(skill_analysis?.match_percentage || 0);
      setAtsAfter(tailorResult.ats_score_estimate || skill_analysis?.match_percentage || 0);

      // Set honest gaps
      setHonestGaps(tailorResult.honest_gaps || []);

      // Show validation warnings if any
      if (tailorResult.validation_warnings?.length > 0) {
        console.warn("Validation warnings:", tailorResult.validation_warnings);
      }

      // Transition to results
      setPhase("results");
      schedule(() => setAtsAnimated(true), 200);
    } catch (err) {
      console.error("AutoTailor error:", err);
      setError(err.message || "Something went wrong");
      setPhase("error");
    }
  };

  const handleUploadClick = () => {
    fileRef.current?.click();
  };

  const handleExport = async () => {
    try {
      await exportResumePdf(tailoredText, job?.role, job?.company);
      if (onToast) onToast("Tailored PDF downloaded");
    } catch (err) {
      console.error("Export failed:", err);
      if (onToast) onToast("PDF export failed");
    }
  };

  const handleRevert = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("upload");
    setStepIdx(-1);
    setAtsAnimated(false);
  };

  const logoChar = job?.logo ?? job?.company?.[0] ?? "?";
  const bgColor = job?.color ?? "#3b82f6";
  const gradient = job?.g ?? bgColor;

  return (
    <div className={`at-overlay${open ? " at-open" : ""}`}>
      <div className="at-shell">
        {/* -- Header -- */}
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

        {/* -- Upload Phase -- */}
        {phase === "upload" && (
          <div className="at-card">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.docx"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <div className="at-upload-zone" onClick={handleUploadClick}>
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
              <p>PDF or TXT up to 5 MB</p>
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

        {/* -- Processing Phase -- */}
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

        {/* -- Error Phase -- */}
        {phase === "error" && (
          <div className="at-card">
            <div className="at-processing">
              <h3>Something went wrong</h3>
              <p style={{ color: "#ef4444", margin: "12px 0" }}>{error}</p>
              <button
                className="at-upload-btn"
                onClick={handleRevert}
                style={{ cursor: "pointer" }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* -- Results Phase -- */}
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
                      style={{ width: atsAnimated ? `${atsBefore}%` : "0%" }}
                    />
                  </div>
                  <span className="at-ats-pct at-ats-pct-red">{atsBefore}%</span>
                </div>

                <div className="at-ats-row">
                  <span>After</span>
                  <div className="at-ats-bar-track">
                    <div
                      className="at-ats-bar-fill at-ats-bar-fill-green"
                      style={{ width: atsAnimated ? `${atsAfter}%` : "0%" }}
                    />
                  </div>
                  <span className="at-ats-pct at-ats-pct-green">
                    {atsAfter}%
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
                  {diffTab === "original" ? originalText : tailoredText}
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
                  AI Summary &mdash; {summaryItems.length} changes made
                </div>
                <ul>
                  {summaryItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Honest gaps */}
              {honestGaps.length > 0 && (
                <div className="at-summary" style={{ borderColor: "#fbbf24" }}>
                  <div className="at-summary-title">
                    Honest Gaps &mdash; skills this role needs that you don't have yet
                  </div>
                  <ul>
                    {honestGaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}

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
