import { supabase, supabaseConfigured } from "../lib/supabase";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

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
 * Tailor the user's resume for a specific job.
 * Returns tailored sections, changes, ATS scores, and honest gaps.
 */
export async function tailorResume(jobId) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("tailor-resume", {
    body: { job_id: jobId },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });

  if (error) {
    const detail = await extractFunctionError(error, error.message);
    throw new Error(`Tailor failed: ${detail}`);
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

  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("coach-resume", {
    body: { job_id: jobId, user_answers: userAnswers },
    headers: { Authorization: `Bearer ${session?.access_token}` },
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
 * Export the user's tailored resume as a downloadable PDF.
 * Fetches the latest tailored resume from Supabase and triggers download.
 */
export async function exportResumePdf(jobId) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase.functions.invoke("export-resume-pdf", {
    body: { job_id: jobId },
  });

  if (error) {
    const detail = await extractFunctionError(error, error.message);
    throw new Error(`Export failed: ${detail}`);
  }

  // If the edge function returns a blob/PDF, trigger download
  if (data instanceof Blob) {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Resume_Tailored.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  return data;
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
