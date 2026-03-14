import { useState, useEffect, useRef } from "react";
import "./AICoach.css";

/* ------------------------------------------------------------------ */
/*  Hard-coded data                                                    */
/* ------------------------------------------------------------------ */
const QUESTIONS = [
  "Let's start with accuracy -- is everything on your current resume still up-to-date? Any roles, dates, or titles that need correcting?",
  "Great. What would you say are your top 2-3 strengths that are most relevant to this role?",
  "Is there any experience or skill the job asks for that you don't have yet? Be honest -- we can work around gaps.",
];

const SUGGESTIONS = [
  {
    title: "Strengthen your summary statement",
    icon: "✏️",
    iconBg: "#ede9fe",
    insight:
      "Your summary is generic and doesn't mention the target role or company. A tailored summary increases recruiter engagement by 40%.",
    why: "Recruiters spend ~7 seconds on an initial scan. A role-specific summary anchors their attention and signals you're a deliberate applicant, not a mass-applier.",
    before:
      "Motivated professional with experience in various technologies seeking a challenging position to leverage my skills.",
    after:
      "Product-focused frontend engineer with 4 years building responsive React applications and design systems, looking to drive UI excellence at Acme Corp as a Senior Frontend Developer.",
    points: 8,
  },
  {
    title: "Quantify your impact with metrics",
    icon: "📊",
    iconBg: "#e0f2fe",
    insight:
      "Your bullet points describe responsibilities but lack measurable outcomes. Adding numbers makes claims concrete and credible.",
    why: "Hiring managers are trained to look for evidence of impact. \"Improved performance\" means nothing without a number; \"Reduced load time by 62%\" is memorable and verifiable.",
    before:
      "Responsible for improving website performance and user experience across the platform.",
    after:
      "Optimized critical rendering path and lazy-loaded below-fold assets, reducing page load time by 62% (3.1 s → 1.2 s) and increasing conversion rate by 14%.",
    points: 10,
  },
  {
    title: "Add missing keywords for ATS match",
    icon: "🔑",
    iconBg: "#fef3c7",
    insight:
      "The job description mentions TypeScript, CI/CD, and accessibility (WCAG) -- none of which appear on your resume. ATS filters may reject you before a human sees it.",
    why: "75% of resumes are rejected by ATS software before reaching a recruiter. Matching keywords from the job posting is the single most effective way to pass automated screens.",
    before:
      "Skills: JavaScript, React, HTML, CSS, Git, Node.js",
    after:
      "Skills: JavaScript, TypeScript, React, Next.js, HTML, CSS, WCAG 2.1 Accessibility, Git, CI/CD (GitHub Actions), Node.js",
    points: 12,
  },
];

const LOADING_STEPS = [
  "Reading experience",
  "Matching keywords",
  "Scoring ATS compatibility",
  "Identifying gaps",
  "Generating suggestions",
  "Finalizing coaching plan",
];

const BASE_SCORE = 52;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AICoach({ job, open, onClose, onToast }) {
  /* phases: choice | qa | loading | coaching | complete */
  const [phase, setPhase] = useState("choice");

  /* Q&A state */
  const [messages, setMessages] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEnd = useRef(null);

  /* Loading state */
  const [loadStep, setLoadStep] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [countdown, setCountdown] = useState(6);

  /* Coaching state */
  const [sugIndex, setSugIndex] = useState(0);
  const [history, setHistory] = useState([]); // {title, status}
  const [score, setScore] = useState(BASE_SCORE);

  /* ---- reset when overlay opens ---- */
  useEffect(() => {
    if (open) {
      setPhase("choice");
      setMessages([]);
      setQIndex(0);
      setInput("");
      setTyping(false);
      setLoadStep(0);
      setLoadProgress(0);
      setCountdown(6);
      setSugIndex(0);
      setHistory([]);
      setScore(BASE_SCORE);
    }
  }, [open]);

  /* ---- auto-scroll chat ---- */
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* ---- push coach question with typing animation ---- */
  const pushQuestion = (idx) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { from: "coach", text: QUESTIONS[idx] }]);
    }, 1200);
  };

  /* ---- Phase 2 handlers ---- */
  const startQA = () => {
    setPhase("qa");
    pushQuestion(0);
  };

  const sendAnswer = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { from: "user", text: input.trim() }]);
    setInput("");
    const next = qIndex + 1;
    if (next < QUESTIONS.length) {
      setQIndex(next);
      pushQuestion(next);
    } else {
      startLoading();
    }
  };

  const skipQuestion = () => {
    const next = qIndex + 1;
    if (next < QUESTIONS.length) {
      setQIndex(next);
      pushQuestion(next);
    } else {
      startLoading();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  };

  /* ---- Phase 3 loading ---- */
  const startLoading = () => {
    setPhase("loading");
    setLoadStep(0);
    setLoadProgress(0);
    setCountdown(6);
  };

  useEffect(() => {
    if (phase !== "loading") return;
    const total = LOADING_STEPS.length;
    const interval = setInterval(() => {
      setLoadStep((s) => {
        const next = s + 1;
        setLoadProgress(Math.round((next / total) * 100));
        setCountdown(total - next);
        if (next >= total) {
          clearInterval(interval);
          setTimeout(() => setPhase("coaching"), 500);
        }
        return next;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [phase]);

  /* ---- Phase 4 coaching actions ---- */
  const approveCard = () => {
    const sug = SUGGESTIONS[sugIndex];
    setHistory((h) => [...h, { title: sug.title, status: "approved" }]);
    setScore((s) => s + sug.points);
    if (onToast) onToast(`+${sug.points} ATS points -- "${sug.title}" applied`);
    advanceCard();
  };

  const skipCard = () => {
    const sug = SUGGESTIONS[sugIndex];
    setHistory((h) => [...h, { title: sug.title, status: "skipped" }]);
    advanceCard();
  };

  const advanceCard = () => {
    const next = sugIndex + 1;
    if (next < SUGGESTIONS.length) {
      setSugIndex(next);
    } else {
      setTimeout(() => setPhase("complete"), 400);
    }
  };

  /* ---- derived values ---- */
  const circumference = 2 * Math.PI * 44;
  const dashOffset =
    circumference - (loadProgress / 100) * circumference;

  /* ---- render helpers ---- */
  const renderLogo = () => {
    if (!job) return null;
    if (job.logo) {
      return <img src={job.logo} alt="" className="coach-job-logo" />;
    }
    return (
      <div
        className="coach-job-logo-placeholder"
        style={{ background: job.color || "#a855f7" }}
      >
        {(job.company || "?")[0]}
      </div>
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
        {/* ===================== Phase 1 ===================== */}
        {phase === "choice" && (
          <div className="coach-choice-wrap">
            <div className="coach-choice-heading">How should we start?</div>
            <div className="coach-choice-sub">
              Choose a path and your AI coach will guide you step by step.
            </div>
            <div className="coach-choice-cards">
              <div className="coach-choice-card" onClick={startQA}>
                <div className="coach-choice-icon">📄</div>
                <h3>I have a resume</h3>
                <p>Upload your existing resume and we'll tailor it for this role.</p>
              </div>
              <div className="coach-choice-card" onClick={startQA}>
                <div className="coach-choice-icon">🛠️</div>
                <h3>Build one from scratch</h3>
                <p>Answer a few questions and we'll create a resume for you.</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== Phase 2 ===================== */}
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
                {Math.min(qIndex + 1, QUESTIONS.length)} / {QUESTIONS.length}
              </span>
            </div>
          </div>
        )}

        {/* ===================== Phase 3 ===================== */}
        {phase === "loading" && (
          <div className="coach-loading-wrap">
            <div className="coach-progress-ring-container">
              <svg
                className="coach-progress-ring"
                width="100"
                height="100"
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

        {/* ===================== Phase 4 ===================== */}
        {phase === "coaching" && sugIndex < SUGGESTIONS.length && (
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
              const sug = SUGGESTIONS[sugIndex];
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
                    <button className="coach-btn-edit">Edit</button>
                    <button className="coach-btn-skip" onClick={skipCard}>
                      Skip
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="coach-card-counter">
              Suggestion {sugIndex + 1} of {SUGGESTIONS.length}
            </div>
          </div>
        )}

        {/* ===================== Phase 5 ===================== */}
        {phase === "complete" && (
          <div className="coach-complete-wrap">
            <div className="coach-complete-check">✓</div>
            <div className="coach-complete-title">Coaching complete</div>
            <div className="coach-complete-sub">
              Your resume has been reviewed and improved. Here's your summary.
            </div>

            <div className="coach-score-summary">
              <span className="coach-score-old">{BASE_SCORE}</span>
              <span className="coach-score-arrow">→</span>
              <span className="coach-score-new">{score}</span>
              <span>ATS score</span>
            </div>

            <div className="coach-lesson-box">
              <div className="coach-lesson-heading">
                What you learned today
              </div>
              <ul>
                <li>
                  A tailored summary statement dramatically increases recruiter
                  engagement.
                </li>
                <li>
                  Quantifying achievements with metrics makes your impact
                  concrete and credible.
                </li>
                <li>
                  Matching keywords from the job description helps you pass
                  ATS filters.
                </li>
                <li>
                  Specificity beats vagueness -- every bullet should prove
                  value, not describe duties.
                </li>
                <li>
                  Reviewing and iterating on your resume before each application
                  compounds over time.
                </li>
              </ul>
            </div>

            <div className="coach-complete-actions">
              <button
                className="coach-btn-export"
                onClick={() => {
                  if (onToast) onToast("Resume exported successfully");
                }}
              >
                Export Resume
              </button>
              <button
                className="coach-btn-restart"
                onClick={() => setPhase("choice")}
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
