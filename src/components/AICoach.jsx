import { useState, useEffect, useRef } from "react";
import { uploadAndParseResume, coachResume, getParsedResume, exportResumePdf } from "../services/resume";
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

      // Check if user already has a parsed resume
      getParsedResume().then((data) => {
        if (data) setHasResume(true);
      });
    }
  }, [open]);

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
    setHistory((h) => [...h, { title: sug.title, status: "approved" }]);
    setScore((s) => s + sug.points);
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
                    <button className="coach-btn-edit">Edit</button>
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

        {/* ===================== Phase 5: Complete ===================== */}
        {phase === "complete" && (
          <div className="coach-complete-wrap">
            <div className="coach-complete-check">✓</div>
            <div className="coach-complete-title">Coaching complete</div>
            <div className="coach-complete-sub">
              Your resume has been reviewed and improved. Here's your summary.
            </div>

            <div className="coach-score-summary">
              <span className="coach-score-old">{baseScore}</span>
              <span className="coach-score-arrow">→</span>
              <span className="coach-score-new">{score}</span>
              <span>ATS score</span>
            </div>

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

            <div className="coach-lesson-box">
              <div className="coach-lesson-heading">
                What you learned today
              </div>
              <ul>
                {history
                  .filter((h) => h.status === "approved")
                  .map((h, i) => (
                    <li key={i}>{h.title}</li>
                  ))}
                {history.filter((h) => h.status === "approved").length === 0 && (
                  <li>Review the suggestions above and try applying them to your resume.</li>
                )}
              </ul>
            </div>

            <div className="coach-complete-actions">
              <button
                className="coach-btn-export"
                onClick={async () => {
                  try {
                    await exportResumePdf();
                    if (onToast) onToast("Resume exported successfully");
                  } catch {
                    if (onToast) onToast("PDF export — check backend is running");
                  }
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
