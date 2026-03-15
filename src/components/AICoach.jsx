import { useState, useEffect, useRef } from "react";
import {
  uploadAndParseResume,
  coachResume,
  getParsedResume,
  getResumeRawText,
  exportResumePdf,
  generateResumePdfDataUri,
  getOriginalResumePdfUrl,
  downloadOriginalResumePdf,
} from "../services/resume";
import CompanyAvatar from "./CompanyAvatar";
import "./AICoach.css";

/* ------------------------------------------------------------------ */
/*  Loading step labels                                                */
/* ------------------------------------------------------------------ */
const LOADING_STEPS = [
  "Reading experience",
  "Matching keywords",
  "Scoring ATS compatibility",
  "Identifying gaps",
  "Generating suggestions",
  "Finalizing coaching plan",
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AICoach({ job, open, onClose, onToast }) {
  /* phases: choice | upload | qa | loading | coaching | complete | error */
  const [phase, setPhase] = useState("choice");

  /* Q&A state */
  const [messages, setMessages] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const messagesEnd = useRef(null);
  const fileRef = useRef(null);

  /* Loading state */
  const [loadStep, setLoadStep] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [countdown, setCountdown] = useState(6);

  /* Coaching state — populated by RAG pipeline */
  const [suggestions, setSuggestions] = useState([]);
  const [genuineGaps, setGenuineGaps] = useState([]);
  const [sugIndex, setSugIndex] = useState(0);
  const [history, setHistory] = useState([]); // {title, status}
  const [baseScore, setBaseScore] = useState(52);
  const [score, setScore] = useState(52);
  const [error, setError] = useState("");

  /* Has a parsed resume already? */
  const [hasResume, setHasResume] = useState(false);

  /* Resume text for comparison */
  const [originalText, setOriginalText] = useState("");
  const [modifiedText, setModifiedText] = useState("");

  /* PDF preview data URIs */
  const [originalPdfUrl, setOriginalPdfUrl] = useState("");
  const [modifiedPdfUrl, setModifiedPdfUrl] = useState("");

  /* ---- reset when overlay opens ---- */
  useEffect(() => {
    if (open) {
      setPhase("choice");
      setMessages([]);
      setQIndex(0);
      setInput("");
      setTyping(false);
      setQuestions([]);
      setUserAnswers({});
      setLoadStep(0);
      setLoadProgress(0);
      setCountdown(6);
      setSugIndex(0);
      setHistory([]);
      setSuggestions([]);
      setGenuineGaps([]);
      setBaseScore(52);
      setScore(52);
      setError("");
      setHasResume(false);
      setOriginalText("");
      setModifiedText("");
      setOriginalPdfUrl("");
      setModifiedPdfUrl("");

      // Check if user already has a parsed resume & fetch raw text
      getParsedResume().then((data) => {
        if (data) setHasResume(true);
      });
      getResumeRawText().then((text) => {
        if (text) {
          setOriginalText(text);
          setModifiedText(text);
        }
      });
    }
  }, [open]);

  /* ---- generate PDF previews when coaching completes ---- */
  useEffect(() => {
    if (phase !== "complete") return;
    const approvedChanges = history
      .filter((h) => h.status === "approved" && h.before && h.after)
      .map((h) => ({ before: h.before, after: h.after }));

    // Original: try to load the actual uploaded PDF first (preserves exact format)
    getOriginalResumePdfUrl()
      .then((url) => {
        if (url) {
          setOriginalPdfUrl(url);
        } else {
          // Fallback: re-render from raw text
          return generateResumePdfDataUri(originalText, job?.role, job?.company, true)
            .then(setOriginalPdfUrl);
        }
      })
      .catch(() => setOriginalPdfUrl(""));

    // Modified: generate with highlighted changes
    generateResumePdfDataUri(modifiedText || originalText, job?.role, job?.company, false, approvedChanges)
      .then(setModifiedPdfUrl)
      .catch(() => setModifiedPdfUrl(""));
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- auto-scroll chat ---- */
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* ---- push coach question with typing animation ---- */
  const pushQuestion = (text) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { from: "coach", text }]);
    }, 800);
  };

  /* ---- Handle file upload for resume ---- */
  const handleFileSelect = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    setPhase("loading");
    setLoadStep(0);

    try {
      await uploadAndParseResume(file);
      setHasResume(true);
      // Now proceed to coaching
      await runCoaching();
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  };

  /* ---- Start paths ---- */
  const startWithExisting = () => {
    if (hasResume) {
      // Already have a resume, go to Q&A with default questions
      startQAWithDefaults();
    } else {
      // Need to upload first
      setPhase("upload");
    }
  };

  const startFromScratch = () => {
    startQAWithDefaults();
  };

  const startQAWithDefaults = () => {
    const defaultQs = [
      "Is everything on your current resume still up-to-date? Any roles, dates, or titles that need correcting?",
      "What would you say are your top 2-3 strengths most relevant to this role?",
      "Is there any experience or skill the job asks for that you don't have yet?",
    ];
    setQuestions(defaultQs);
    setPhase("qa");
    pushQuestion(defaultQs[0]);
  };

  /* ---- Phase 2 handlers ---- */
  const sendAnswer = () => {
    if (!input.trim()) return;
    const answer = input.trim();
    setMessages((prev) => [...prev, { from: "user", text: answer }]);
    setUserAnswers((prev) => ({
      ...prev,
      [questions[qIndex]]: answer,
    }));
    setInput("");

    const next = qIndex + 1;
    if (next < questions.length) {
      setQIndex(next);
      pushQuestion(questions[next]);
    } else {
      runCoaching();
    }
  };

  const skipQuestion = () => {
    const next = qIndex + 1;
    if (next < questions.length) {
      setQIndex(next);
      pushQuestion(questions[next]);
    } else {
      runCoaching();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  };

  /* ---- Run the RAG coaching pipeline ---- */
  const runCoaching = async () => {
    setPhase("loading");
    setLoadStep(0);
    setLoadProgress(0);
    setCountdown(LOADING_STEPS.length);

    try {
      // Animate loading steps while waiting for API
      const stepTimer = setInterval(() => {
        setLoadStep((s) => {
          const next = s + 1;
          setLoadProgress(Math.round((next / LOADING_STEPS.length) * 100));
          setCountdown(LOADING_STEPS.length - next);
          if (next >= LOADING_STEPS.length) clearInterval(stepTimer);
          return next;
        });
      }, 1200);

      const result = await coachResume(job.id, userAnswers, job.about || job.desc || "");
      clearInterval(stepTimer);
      setLoadStep(LOADING_STEPS.length);
      setLoadProgress(100);
      setCountdown(0);

      const { result: coachResult, skill_analysis } = result;

      // Map suggestions from the RAG response
      const sug = (coachResult.suggestions || []).map((s) => ({
        title: s.title,
        icon: s.icon || "✏️",
        iconBg: s.icon_bg || "#ede9fe",
        insight: s.insight,
        why: s.why,
        before: s.before,
        after: s.after,
        points: s.ats_points || 0,
      }));

      setSuggestions(sug);
      setGenuineGaps(coachResult.genuine_gaps || []);
      setBaseScore(skill_analysis?.match_percentage || coachResult.overall_ats_score || 52);
      setScore(skill_analysis?.match_percentage || coachResult.overall_ats_score || 52);

      // Set dynamic follow-up questions if provided
      if (coachResult.questions?.length) {
        setQuestions(coachResult.questions);
      }

      if (coachResult.validation_warnings?.length > 0) {
        console.warn("Coach validation warnings:", coachResult.validation_warnings);
      }

      setTimeout(() => setPhase("coaching"), 500);
    } catch (err) {
      console.error("Coach error:", err);
      setError(err.message || "Coaching failed");
      setPhase("error");
    }
  };

  /* ---- Phase 4 coaching actions ---- */
  const approveCard = () => {
    const sug = suggestions[sugIndex];
    setHistory((h) => [...h, { title: sug.title, status: "approved", before: sug.before, after: sug.after }]);
    setScore((s) => s + sug.points);

    // Apply the before→after change to the modified resume text
    if (sug.before && sug.after) {
      setModifiedText((prev) => {
        // Try exact match first, then fuzzy line-by-line
        if (prev.includes(sug.before)) {
          return prev.replace(sug.before, sug.after);
        }
        // Fuzzy: find the closest matching substring and replace
        const beforeLines = sug.before.split("\n").map((l) => l.trim()).filter(Boolean);
        let result = prev;
        for (const line of beforeLines) {
          if (line.length > 10 && result.includes(line)) {
            const afterLine = sug.after.split("\n").find((al) => al.trim().length > 10) || sug.after;
            result = result.replace(line, afterLine.trim());
            break;
          }
        }
        return result;
      });
    }

    if (onToast) onToast(`+${sug.points} ATS points -- "${sug.title}" applied`);
    advanceCard();
  };

  const skipCard = () => {
    const sug = suggestions[sugIndex];
    setHistory((h) => [...h, { title: sug.title, status: "skipped" }]);
    advanceCard();
  };

  const advanceCard = () => {
    const next = sugIndex + 1;
    if (next < suggestions.length) {
      setSugIndex(next);
    } else {
      setTimeout(() => setPhase("complete"), 400);
    }
  };

  const handleRegenerate = async (sug) => {
    try {
      if (onToast) onToast("Feature not available");
    } catch (err) {
      console.error("Regenerate error:", err);
    }
  };

  /* ---- derived values ---- */
  const circumference = 2 * Math.PI * 44;
  const dashOffset =
    circumference - (loadProgress / 100) * circumference;

  /* ---- render helpers ---- */
  const renderLogo = () => {
    if (!job) return null;
    return (
      <CompanyAvatar
        logoUrl={job.logoUrl}
        company={job.company}
        color={job.color || "#a855f7"}
        size={36}
        radius={10}
      />
    );
  };

  /* ================================================================ */
  /*  JSX                                                              */
  /* ================================================================ */
  return (
    <div className={`coach-overlay${open ? " coach-open" : ""}`}>
      {/* Header */}
      <div className="coach-header">
        <div className="coach-header-left">
          {renderLogo()}
          <div>
            <div className="coach-header-title">
              AI Coach {job ? `-- ${job.role}` : ""}
            </div>
            <div className="coach-header-sub">
              {job ? `${job.company} \u00b7 ${job.location}` : "Resume coaching"}
            </div>
          </div>
        </div>
        <button className="coach-close-btn" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      <div className="coach-body">
        {/* ===================== Phase 1: Choice ===================== */}
        {phase === "choice" && (
          <div className="coach-choice-wrap">
            <div className="coach-choice-heading">How should we start?</div>
            <div className="coach-choice-sub">
              Choose a path and your AI coach will guide you step by step.
            </div>
            <div className="coach-choice-cards">
              <div className="coach-choice-card" onClick={startWithExisting}>
                <div className="coach-choice-icon">
                  {hasResume ? "✓" : "📄"}
                </div>
                <h3>I have a resume</h3>
                <p>
                  {hasResume
                    ? "Your resume is already uploaded. Let's coach it for this role."
                    : "Upload your existing resume and we'll tailor it for this role."}
                </p>
              </div>
              <div className="coach-choice-card" onClick={startFromScratch}>
                <div className="coach-choice-icon">🛠️</div>
                <h3>Build one from scratch</h3>
                <p>Answer a few questions and we'll create a resume for you.</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== Upload Phase ===================== */}
        {phase === "upload" && (
          <div className="coach-choice-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.docx"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <div className="coach-choice-heading">Upload your resume</div>
            <div className="coach-choice-sub">
              PDF or TXT up to 5 MB. We'll parse it and coach you for this role.
            </div>
            <button
              className="coach-btn-approve"
              onClick={() => fileRef.current?.click()}
              style={{ marginTop: "20px" }}
            >
              Choose file
            </button>
          </div>
        )}

        {/* ===================== Phase 2: Q&A ===================== */}
        {phase === "qa" && (
          <div className="coach-qa-wrap">
            <div className="coach-qa-messages">
              {messages.map((m, i) =>
                m.from === "coach" ? (
                  <div className="coach-bubble-row" key={i}>
                    <div className="coach-avatar">✦</div>
                    <div className="coach-bubble">{m.text}</div>
                  </div>
                ) : (
                  <div className="coach-user-row" key={i}>
                    <div className="coach-user-bubble">{m.text}</div>
                  </div>
                )
              )}
              {typing && (
                <div className="coach-bubble-row">
                  <div className="coach-avatar">✦</div>
                  <div className="coach-bubble">
                    <span className="coach-dots">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            <div className="coach-qa-input-bar">
              <input
                className="coach-qa-input"
                placeholder="Type your answer..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="coach-send-btn" onClick={sendAnswer}>
                ↑
              </button>
            </div>
            <div className="coach-qa-meta">
              <button className="coach-skip-btn" onClick={skipQuestion}>
                Skip this question
              </button>
              <span className="coach-q-counter">
                {Math.min(qIndex + 1, questions.length)} / {questions.length}
              </span>
            </div>
          </div>
        )}

        {/* ===================== Phase 3: Loading ===================== */}
        {phase === "loading" && (
          <div className="coach-loading-wrap">
            <div className="coach-progress-ring-container">
              <svg
                className="coach-progress-ring"
                width="120"
                height="120"
                viewBox="0 0 100 100"
              >
                <circle className="ring-bg" cx="50" cy="50" r="44" />
                <circle
                  className="ring-fg"
                  cx="50"
                  cy="50"
                  r="44"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="coach-countdown-num">{countdown}</div>
            </div>

            <div className="coach-loading-title">Analyzing your profile...</div>

            <div className="coach-steps">
              {LOADING_STEPS.map((label, i) => {
                const status =
                  i < loadStep ? "done" : i === loadStep ? "active" : "";
                return (
                  <div className={`coach-step ${status}`} key={i}>
                    <span className="coach-step-icon">
                      {i < loadStep ? "✓" : i === loadStep ? "●" : "○"}
                    </span>
                    {label}
                  </div>
                );
              })}
            </div>

            <div className="coach-bar-track">
              <div
                className="coach-bar-fill"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* ===================== Error Phase ===================== */}
        {phase === "error" && (
          <div className="coach-choice-wrap">
            <div className="coach-choice-heading">Something went wrong</div>
            <p style={{ color: "#ef4444", margin: "12px 0" }}>{error}</p>
            <button
              className="coach-btn-approve"
              onClick={() => setPhase("choice")}
            >
              Try again
            </button>
          </div>
        )}

        {/* ===================== Phase 4: Coaching ===================== */}
        {phase === "coaching" && sugIndex < suggestions.length && (
          <div className="coach-live-wrap">
            {/* ATS score bar */}
            <div className="coach-ats-bar">
              <span className="coach-ats-label">ATS Score</span>
              <div className="coach-ats-track">
                <div
                  className="coach-ats-fill"
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="coach-ats-score">{score}</span>
            </div>

            {/* Collapsed history */}
            {history.map((h, i) => (
              <div
                className={`coach-card-collapsed${
                  h.status === "skipped" ? " skipped" : ""
                }`}
                key={i}
              >
                <span className="coach-collapsed-icon">
                  {h.status === "approved" ? "✓" : "✗"}
                </span>
                <span className="coach-collapsed-title">{h.title}</span>
                <span
                  className={`coach-collapsed-badge ${h.status}`}
                >
                  {h.status === "approved" ? "Applied" : "Skipped"}
                </span>
              </div>
            ))}

            {/* Active suggestion card */}
            {(() => {
              const sug = suggestions[sugIndex];
              return (
                <div className="coach-suggestion-card" key={sugIndex}>
                  <div className="coach-sug-header">
                    <div
                      className="coach-sug-icon"
                      style={{ background: sug.iconBg }}
                    >
                      {sug.icon}
                    </div>
                    <div className="coach-sug-title">{sug.title}</div>
                  </div>
                  <div className="coach-sug-insight">{sug.insight}</div>
                  <div className="coach-sug-why">{sug.why}</div>

                  <div className="coach-diff">
                    <div className="coach-diff-before">
                      <div className="coach-diff-label">Before</div>
                      {sug.before}
                    </div>
                    <div className="coach-diff-after">
                      <div className="coach-diff-label">After</div>
                      {sug.after}
                    </div>
                  </div>

                  <div className="coach-sug-actions">
                    <button className="coach-btn-approve" onClick={approveCard}>
                      Approve change
                    </button>
                    <button className="coach-btn-edit" onClick={() => handleRegenerate(sug)}>
                      Regenerate
                    </button>
                    <button className="coach-btn-skip" onClick={skipCard}>
                      Skip
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="coach-card-counter">
              Suggestion {sugIndex + 1} of {suggestions.length}
            </div>
          </div>
        )}

        {/* ===================== Phase 5: Complete — Comparison ===================== */}
        {phase === "complete" && (() => {
          const approvedChanges = history.filter((h) => h.status === "approved" && h.before && h.after);
          return (
          <div className="coach-complete-wrap coach-compare-layout">
            <div className="coach-complete-check">✓</div>
            <div className="coach-complete-title">Coaching complete</div>
            <div className="coach-complete-sub">
              Your resume with {approvedChanges.length} improvement{approvedChanges.length !== 1 ? "s" : ""} highlighted below.
            </div>

            <div className="coach-score-summary">
              <span className="coach-score-old">{baseScore}</span>
              <span className="coach-score-arrow">→</span>
              <span className="coach-score-new">{score}</span>
              <span>ATS score</span>
            </div>

            {/* Your resume — exact original format */}
            <div className="coach-compare-panel" style={{ width: "100%", maxWidth: 560 }}>
              <div className="coach-compare-panel-header">
                <span className="coach-compare-dot" style={{ background: "#3b82f6" }} />
                Your Resume
              </div>
              {originalPdfUrl ? (
                <iframe
                  src={originalPdfUrl}
                  className="coach-compare-pdf"
                  title="Your Resume"
                  style={{ height: 500 }}
                />
              ) : (
                <div className="coach-compare-content">Loading preview...</div>
              )}
            </div>

            {/* Changes applied — before/after diff cards */}
            {approvedChanges.length > 0 && (
              <div className="coach-changes-section">
                <div className="coach-changes-heading">
                  Changes to apply ({approvedChanges.length})
                </div>
                {approvedChanges.map((h, i) => (
                  <div className="coach-change-card" key={i}>
                    <div className="coach-change-title">{h.title}</div>
                    <div className="coach-change-diff">
                      <div className="coach-change-before">
                        <div className="coach-change-label">Before</div>
                        <div className="coach-change-text">{h.before}</div>
                      </div>
                      <div className="coach-change-arrow">→</div>
                      <div className="coach-change-after">
                        <div className="coach-change-label">After</div>
                        <div className="coach-change-text">{h.after}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Genuine gaps */}
            {genuineGaps.length > 0 && (
              <div className="coach-lesson-box" style={{ borderColor: "#fbbf24" }}>
                <div className="coach-lesson-heading">Honest skill gaps</div>
                <ul>
                  {genuineGaps.map((gap, i) => (
                    <li key={i}>
                      <strong>{gap.skill}</strong>: {gap.suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="coach-complete-actions">
              <button
                className="coach-btn-export"
                onClick={async () => {
                  try {
                    // Download the actual uploaded PDF (exact format preserved)
                    const blob = await downloadOriginalResumePdf();
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Resume_${(job?.company || "export").replace(/\s+/g, "_")}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } else {
                      await exportResumePdf(originalText, job?.role, job?.company, true);
                    }
                    if (onToast) onToast("Resume downloaded");
                  } catch {
                    if (onToast) onToast("PDF export failed");
                  }
                }}
              >
                Download Resume
              </button>
              <button
                className="coach-btn-export"
                onClick={async () => {
                  try {
                    const changes = approvedChanges.map((h) => ({ before: h.before, after: h.after }));
                    await exportResumePdf(modifiedText || originalText, job?.role, job?.company, false, changes);
                    if (onToast) onToast("Changes sheet downloaded");
                  } catch {
                    if (onToast) onToast("PDF export failed");
                  }
                }}
              >
                Download Changes
              </button>
              <button
                className="coach-btn-restart"
                onClick={() => setPhase("choice")}
              >
                Start Over
              </button>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
