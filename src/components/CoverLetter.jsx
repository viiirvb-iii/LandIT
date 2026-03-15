import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import CompanyAvatar from "./CompanyAvatar";
import {
  generateCoverLetter,
  generateOutreach,
  regenerateCoverLetter,
} from "../services/resume";

const TABS = [
  { id: "cover_letter", label: "Cover Letter" },
  { id: "outreach", label: "Outreach Email" },
];

export default function CoverLetter({ job, open, onClose, onToast }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("cover_letter");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [outreach, setOutreach] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [version, setVersion] = useState(0);
  const letterRef = useRef(null);

  const userName = user?.user_metadata?.full_name || "Your Name";
  const userEmail = user?.email || "your.email@example.com";
  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      if (tab === "cover_letter") {
        const result = await generateCoverLetter(job.id);
        setContent(result.content || "");
        setVersion(result.version || 1);
      } else {
        const result = await generateOutreach(job.id);
        setOutreach(result.content || "");
        setVersion(result.version || 1);
      }
      if (onToast) onToast(`${tab === "cover_letter" ? "Cover letter" : "Outreach email"} generated`);
    } catch (err) {
      console.error("Generation error:", err);
      if (onToast) onToast(err.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!editInstruction.trim()) return;
    setLoading(true);
    try {
      const result = await regenerateCoverLetter(job.id, editInstruction);
      setContent(result.content || "");
      setVersion(result.version || version + 1);
      setEditMode(false);
      setEditInstruction("");
      if (onToast) onToast("Cover letter regenerated");
    } catch (err) {
      if (onToast) onToast(err.message || "Regeneration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = tab === "cover_letter" ? content : outreach;
    navigator.clipboard.writeText(text).then(() => {
      if (onToast) onToast("Copied to clipboard");
    });
  };

  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const margin = 25;
      const maxW = pw - margin * 2;
      let y = 30;

      const text = tab === "cover_letter" ? content : outreach;

      // Header: user name
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(userName, margin, y);
      y += 6;

      // User email
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(userEmail, margin, y);
      y += 10;

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pw - margin, y);
      y += 10;

      // Date
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(today, margin, y);
      y += 10;

      // Greeting — "Dear Hiring Manager,"
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text("Dear Hiring Manager,", margin, y);
      y += 8;

      // Body
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 25; }
        doc.text(line, margin, y);
        y += 5.5;
      }

      // Sign-off
      y += 6;
      if (y > 265) { doc.addPage(); y = 25; }
      doc.setTextColor(15, 23, 42);
      doc.text("Kind regards,", margin, y);
      y += 7;
      doc.setFont("helvetica", "bold");
      doc.text(userName, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(userEmail, margin, y);

      doc.save(
        `${tab === "cover_letter" ? "Cover_Letter" : "Outreach"}_${(job?.company || "export").replace(/\s+/g, "_")}.pdf`
      );
      if (onToast) onToast("PDF downloaded");
    } catch {
      if (onToast) onToast("PDF export failed");
    }
  };

  const currentContent = tab === "cover_letter" ? content : outreach;

  if (!open) return null;

  return (
    <div className="cl-overlay">
      <div className="cl-shell">
        {/* Header */}
        <div className="cl-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CompanyAvatar
              logoUrl={job?.logoUrl}
              company={job?.company}
              color={job?.color || "#3b82f6"}
              size={36}
              radius={10}
            />
            <div>
              <h2 className="cl-title">
                {tab === "cover_letter" ? "Cover Letter" : "Outreach Email"}
              </h2>
              <span className="cl-sub">{job?.role} at {job?.company}</span>
            </div>
          </div>
          <button className="cl-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="cl-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`cl-tab${tab === t.id ? " cl-tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        {!currentContent ? (
          <div className="cl-empty">
            <div className="cl-empty-icon">
              {tab === "cover_letter" ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              )}
            </div>
            <p className="cl-empty-text">
              Generate a {tab === "cover_letter" ? "cover letter" : "cold outreach email"} tailored to this job using your resume.
            </p>
            <button className="cl-btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <span className="cl-spinner" />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Generate
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Letter preview */}
            <div className="cl-letter" ref={letterRef}>
              <div className="cl-letter-version">v{version}</div>

              {/* Sender info */}
              <div className="cl-letter-sender">
                <div className="cl-letter-sender-name">{userName}</div>
                <div className="cl-letter-sender-email">{userEmail}</div>
              </div>

              <div className="cl-letter-divider" />

              <div className="cl-letter-date">{today}</div>

              {/* Greeting */}
              <div className="cl-letter-greeting">Dear Hiring Manager,</div>

              {/* Body */}
              <div className="cl-letter-body">{currentContent}</div>

              {/* Sign-off */}
              <div className="cl-letter-signoff">
                <div>Kind regards,</div>
                <div className="cl-letter-signoff-name">{userName}</div>
                <div className="cl-letter-signoff-email">{userEmail}</div>
              </div>
            </div>

            {/* Edit/regenerate */}
            {editMode ? (
              <div className="cl-edit-bar">
                <input
                  className="cl-edit-input"
                  placeholder="e.g. Make it more concise, emphasize leadership..."
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRegenerate(); }}
                />
                <button className="cl-btn-primary cl-btn-sm" onClick={handleRegenerate} disabled={loading}>
                  {loading ? <span className="cl-spinner" /> : "Regenerate"}
                </button>
                <button className="cl-btn-outline cl-btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            ) : (
              <div className="cl-actions">
                <button className="cl-btn-primary" onClick={handleExportPdf}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </button>
                <button className="cl-btn-outline" onClick={handleCopy}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy
                </button>
                <button className="cl-btn-outline" onClick={() => setEditMode(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button className="cl-btn-outline" onClick={handleGenerate} disabled={loading}>
                  {loading ? <span className="cl-spinner" /> : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                      New
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .cl-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: #f5f5f7;
          display: flex; justify-content: center; padding: 0;
          overflow-y: auto;
        }
        .cl-shell {
          width: 100%; max-width: 680px;
          padding: 28px 24px 36px;
        }

        /* Header */
        .cl-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 24px;
        }
        .cl-title {
          font-size: 16px; font-weight: 700; color: #0f172a;
          margin: 0; letter-spacing: -0.02em;
        }
        .cl-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; display: block; }
        .cl-close {
          width: 36px; height: 36px; border-radius: 50%;
          border: 1px solid #e2e8f0; background: #fff;
          color: #64748b; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s;
        }
        .cl-close:hover { background: #f1f5f9; color: #0f172a; }
        .cl-close svg { width: 16px; height: 16px; }

        /* Tabs */
        .cl-tabs {
          display: flex; gap: 0;
          border-bottom: 1px solid #e2e8f0; margin-bottom: 24px;
        }
        .cl-tab {
          flex: 1; padding: 11px 0; text-align: center;
          font-size: 13px; font-weight: 600; font-family: inherit;
          color: #94a3b8; background: none; border: none;
          border-bottom: 2px solid transparent; cursor: pointer;
          transition: color 0.15s;
        }
        .cl-tab:hover { color: #64748b; }
        .cl-tab-active { color: #3b82f6; border-bottom-color: #3b82f6; }

        /* Empty state */
        .cl-empty {
          text-align: center; padding: 64px 28px;
          background: #fff; border-radius: 20px;
          border: 1px solid #e2e8f0;
        }
        .cl-empty-icon { margin-bottom: 20px; }
        .cl-empty-icon svg { width: 48px; height: 48px; }
        .cl-empty-text {
          color: #64748b; font-size: 13px; line-height: 1.6;
          margin: 0 0 28px; max-width: 380px; margin-left: auto; margin-right: auto;
        }

        /* Letter preview — looks like a real letter */
        .cl-letter {
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 20px; padding: 30px 26px;
          margin-bottom: 20px; position: relative;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        }
        .cl-letter-version {
          position: absolute; top: 18px; right: 22px;
          font-size: 12px; color: #cbd5e1; font-weight: 600;
          background: #f8fafc; padding: 3px 10px; border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        .cl-letter-sender { margin-bottom: 16px; }
        .cl-letter-sender-name {
          font-size: 14px; font-weight: 700; color: #0f172a;
          letter-spacing: -0.01em;
        }
        .cl-letter-sender-email {
          font-size: 11px; color: #94a3b8; margin-top: 2px;
        }
        .cl-letter-divider {
          height: 1px; background: #e2e8f0; margin: 20px 0;
        }
        .cl-letter-date {
          font-size: 11px; color: #94a3b8; margin-bottom: 20px;
        }
        .cl-letter-greeting {
          font-size: 13px; font-weight: 600; color: #0f172a;
          margin-bottom: 14px;
        }
        .cl-letter-body {
          font-size: 13px; line-height: 1.7; color: #334155;
          white-space: pre-wrap;
        }
        .cl-letter-signoff {
          margin-top: 22px; font-size: 13px; color: #334155;
        }
        .cl-letter-signoff-name {
          font-weight: 700; color: #0f172a; margin-top: 6px;
        }
        .cl-letter-signoff-email {
          font-size: 11px; color: #94a3b8; margin-top: 3px;
        }

        /* Actions */
        .cl-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .cl-edit-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .cl-edit-input {
          flex: 1; min-width: 200px; padding: 11px 14px; border-radius: 12px;
          background: #fff; border: 1px solid #e2e8f0;
          color: #0f172a; font-size: 12px; font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .cl-edit-input:focus { border-color: #3b82f6; }
        .cl-edit-input::placeholder { color: #cbd5e1; }

        /* Buttons */
        .cl-btn-primary {
          padding: 11px 20px; border-radius: 12px;
          background: #3b82f6; color: #fff;
          font-size: 13px; font-weight: 600; border: none;
          cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center; gap: 7px;
          transition: background 0.15s;
        }
        .cl-btn-primary:hover { background: #2563eb; }
        .cl-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .cl-btn-outline {
          padding: 11px 16px; border-radius: 12px;
          background: #fff; color: #475569;
          border: 1px solid #e2e8f0; font-size: 13px;
          font-weight: 600; cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center; gap: 7px;
          transition: all 0.15s;
        }
        .cl-btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
        .cl-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

        .cl-btn-sm { padding: 9px 14px; font-size: 12px; }

        /* Spinner */
        .cl-spinner {
          display: inline-block; width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: cl-spin 0.6s linear infinite;
        }
        .cl-btn-outline .cl-spinner {
          border-color: rgba(0,0,0,0.1);
          border-top-color: #64748b;
        }
        @keyframes cl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
