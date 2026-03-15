import { supabase, supabaseConfigured } from "../lib/supabase";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

/** Get a valid access token, refreshing if needed */
async function getAccessToken() {
  const { data: refreshData } = await supabase.auth.refreshSession();
  const session = refreshData?.session
    || (await supabase.auth.getSession()).data?.session;
  if (!session?.access_token) {
    throw new Error("Not authenticated. Please sign in again.");
  }
  return session.access_token;
}

/** Extract the real error message from a Supabase functions error */
async function extractFunctionError(error, fallbackMsg) {
  if (error instanceof FunctionsHttpError) {
    try {
      const errBody = await error.context.json();
      return errBody?.error || errBody?.details || JSON.stringify(errBody);
    } catch {
      try {
        return await error.context.text();
      } catch {
        return fallbackMsg;
      }
    }
  }
  if (error instanceof FunctionsRelayError) return `Relay error: ${error.message}`;
  if (error instanceof FunctionsFetchError) return `Fetch error: ${error.message}`;
  return error?.message || fallbackMsg;
}

/**
 * Upload a resume file to Supabase Storage, then trigger parsing.
 * Returns the parsed resume data including extracted skills.
 */
export async function uploadAndParseResume(file) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  // Force a fresh session — refreshes the access token
  const { data: refreshData, error: refreshError } =
    await supabase.auth.refreshSession();
  const session = refreshData?.session;
  if (refreshError || !session) {
    // If refresh fails, try getSession as fallback
    const { data: { session: fallbackSession } } = await supabase.auth.getSession();
    if (!fallbackSession) {
      throw new Error("Not authenticated. Please sign out and sign in again.");
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated. Please sign in first.");
  }

  // 1. Upload to Supabase Storage
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const storagePath = `${user.id}/resume.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("resumes")
    .upload(storagePath, file, { upsert: true });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  // 2. Call parse-resume Edge Function with explicit auth header
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("parse-resume", {
    body: { storage_path: storagePath },
    headers: {
      Authorization: `Bearer ${currentSession?.access_token}`,
    },
  });

  if (error) {
    const detail = await extractFunctionError(error, error.message);
    throw new Error(`Parse failed: ${detail}`);
  }
  return data;
}

/**
 * Get AI coaching suggestions for a job application.
 * Optionally pass user answers from Q&A phase.
 */
export async function coachResume(jobId, userAnswers = null) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const token = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("coach-resume", {
    body: { job_id: jobId, user_answers: userAnswers },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    const detail = await extractFunctionError(error, error.message);
    throw new Error(`Coach failed: ${detail}`);
  }
  return data;
}

/**
 * Check if the user already has a parsed resume.
 */
export async function getParsedResume() {
  if (!supabaseConfigured || !supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from("parsed_resumes")
    .select("parsed_data, skills_extracted, parsed_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  return data;
}

/**
 * Compute a real match score between user skills and job skills.
 * Pure deterministic — no LLM involved.
 */
export function computeMatchScore(userSkills, jobSkillMatches) {
  if (!jobSkillMatches || jobSkillMatches.length === 0) return 0;

  const userSet = new Set(
    (userSkills || []).map((s) => s.toLowerCase())
  );

  const jobSkills = jobSkillMatches.map(
    (s) => (s.name || s.skill || s || "").toLowerCase()
  );

  const matched = jobSkills.filter((s) => userSet.has(s));
  return Math.round((matched.length / jobSkills.length) * 100);
}

/**
 * Export tailored resume text as a downloadable PDF.
 * Generates the PDF client-side using jsPDF.
 *
 * @param {string} resumeText - The resume text to render
 * @param {string} jobTitle
 * @param {string} company
 * @param {boolean} isOriginal - true = original, false = improved
 * @param {Array<{before: string, after: string}>} changes - approved changes to highlight in the improved version
 */
export async function exportResumePdf(resumeText, jobTitle, company, isOriginal = false, changes = []) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  // Body — render resume content directly (no "Tailored Resume" header)
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Build a set of "after" lines to know which lines to highlight
  const highlightLines = new Set();
  if (!isOriginal && changes.length > 0) {
    for (const change of changes) {
      if (change.after) {
        // Split after text into individual lines and trim for matching
        const afterLines = change.after.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const al of afterLines) {
          highlightLines.add(al);
        }
      }
    }
  }

  const allLines = doc.splitTextToSize(resumeText || "No content", maxWidth);

  for (const line of allLines) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }

    const trimmed = line.trim();
    const isHeader = trimmed === trimmed.toUpperCase() && trimmed.length > 2 && trimmed.length < 40;

    // Check if this line should be highlighted (it's a changed line)
    let shouldHighlight = false;
    if (!isOriginal && highlightLines.size > 0) {
      for (const hl of highlightLines) {
        if (trimmed.length > 5 && (trimmed.includes(hl) || hl.includes(trimmed))) {
          shouldHighlight = true;
          break;
        }
      }
    }

    if (isHeader) {
      y += 4;
      // Section header — bold, slightly larger, with underline
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(line, margin, y);
      // Underline
      const textWidth = doc.getTextWidth(line);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 1.2, margin + textWidth, y + 1.2);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
    } else {
      if (shouldHighlight) {
        // Yellow highlight background behind the changed text
        const textWidth = doc.getTextWidth(line);
        doc.setFillColor(255, 247, 205); // light yellow
        doc.rect(margin - 1, y - 3.5, Math.min(textWidth + 2, maxWidth + 2), 5, "F");
        doc.setTextColor(0, 100, 0); // dark green text for changed content
        doc.text(line, margin, y);
        doc.setTextColor(0);
      } else {
        doc.text(line, margin, y);
      }
    }
    y += 5.5;
  }

  // Footer — small label at bottom of last page
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(160);
  if (!isOriginal && changes.length > 0) {
    doc.text(`Tailored for: ${jobTitle || ""} at ${company || ""} · ${changes.length} change(s) highlighted`, margin, pageH - 10);
  }
  doc.setTextColor(0);

  const prefix = isOriginal ? "Resume_Original" : "Resume_Tailored";
  doc.save(`${prefix}_${(company || "export").replace(/\s+/g, "_")}.pdf`);
}

/**
 * Get full Resume-Matcher style analysis for a job.
 * Combines TF-IDF, semantic similarity, skill matching, and preference matching.
 */
export async function matchResumeToJob(jobId) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("match-resume", {
    body: { job_id: jobId },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (error) {
    const detail = await extractFunctionError(error, error.message);
    throw new Error(`Match failed: ${detail}`);
  }
  return data;
}

/**
 * Fetch user's real skills from the database (populated by resume parsing).
 * Returns skills with levels and tags for the Dashboard.
 */
export async function getUserSkills() {
  if (!supabaseConfigured || !supabase) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data } = await supabase
    .from("user_skills")
    .select("skill_name, level, tag")
    .eq("user_id", session.user.id)
    .order("level", { ascending: false });

  return (data || []).map((s) => ({
    name: s.skill_name,
    level: s.level,
    tag: s.tag,
  }));
}

/**
 * Fetch real skill gaps aggregated from job applications.
 */
export async function getSkillGaps() {
  if (!supabaseConfigured || !supabase) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data } = await supabase
    .from("skill_gaps")
    .select("skill_name, frequency")
    .eq("user_id", session.user.id)
    .order("frequency", { ascending: false })
    .limit(10);

  return (data || []).map((g) => ({
    name: g.skill_name,
    freq: g.frequency,
  }));
}

/**
 * Tailor the user's resume for a specific job.
 * Calls the tailor-resume Edge Function which runs the full RAG pipeline.
 * Returns tailored sections, diff, and skill analysis.
 */
export async function tailorResume(jobId, mode = "keywords") {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase not configured");
  const token = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("tailor-resume", {
    body: { job_id: jobId, mode },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    const detail = await extractFunctionError(error, error.message);
    throw new Error(`Tailor failed: ${detail}`);
  }
  return data;
}

/**
 * Fetch the user's original resume raw text.
 */
export async function getResumeRawText() {
  if (!supabaseConfigured || !supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from("parsed_resumes")
    .select("raw_text, parsed_data")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!data) return null;
  return data.raw_text || JSON.stringify(data.parsed_data, null, 2);
}

/* ── Cover Letter / Outreach ── */

/**
 * Generate a cover letter for a job.
 */
export async function generateCoverLetter(jobId, language = "en") {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase not configured");
  const token = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
    body: { job_id: jobId, action: "cover_letter", language },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(`Cover letter failed: ${await extractFunctionError(error, error.message)}`);
  return data;
}

/**
 * Generate an outreach message for a job.
 */
export async function generateOutreach(jobId, language = "en") {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase not configured");
  const token = await getAccessToken();
  const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
    body: { job_id: jobId, action: "outreach", language },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(`Outreach failed: ${await extractFunctionError(error, error.message)}`);
  return data;
}

/**
 * Regenerate a cover letter with user edits/instructions.
 */
export async function regenerateCoverLetter(jobId, userEdits, language = "en") {
  if (!supabaseConfigured || !supabase) throw new Error("Supabase not configured");
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
    body: { job_id: jobId, action: "cover_letter", language, user_edits: userEdits },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  if (error) throw new Error(`Regenerate failed: ${await extractFunctionError(error, error.message)}`);
  return data;
}

