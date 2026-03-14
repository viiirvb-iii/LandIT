import { supabase, supabaseConfigured } from "../lib/supabase";

/**
 * Upload a resume file to Supabase Storage, then trigger parsing.
 * Returns the parsed resume data including extracted skills.
 */
export async function uploadAndParseResume(file) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  // Use getSession() (local cache) instead of getUser() (network request)
  // to avoid race conditions after signup
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error(
      "Not authenticated. Please sign in first."
    );
  }
  const user = session.user;

  // 1. Upload to Supabase Storage
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const storagePath = `${user.id}/resume.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("resumes")
    .upload(storagePath, file, { upsert: true });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  // 2. Call parse-resume Edge Function
  const { data, error } = await supabase.functions.invoke("parse-resume", {
    body: { storage_path: storagePath },
  });

  if (error) throw new Error(`Parse failed: ${error.message}`);
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

  const { data, error } = await supabase.functions.invoke("tailor-resume", {
    body: { job_id: jobId },
  });

  if (error) throw new Error(`Tailor failed: ${error.message}`);
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

  const { data, error } = await supabase.functions.invoke("coach-resume", {
    body: { job_id: jobId, user_answers: userAnswers },
  });

  if (error) throw new Error(`Coach failed: ${error.message}`);
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
  const user = session.user;

  const { data } = await supabase
    .from("parsed_resumes")
    .select("parsed_data, skills_extracted, parsed_at")
    .eq("user_id", user.id)
    .single();

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
 * Get full Resume-Matcher style analysis for a job.
 * Combines TF-IDF, semantic similarity, skill matching, and preference matching.
 */
export async function matchResumeToJob(jobId) {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await supabase.functions.invoke("match-resume", {
    body: { job_id: jobId },
  });

  if (error) throw new Error(`Match failed: ${error.message}`);
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
  const user = session.user;

  const { data } = await supabase
    .from("user_skills")
    .select("skill_name, level, tag")
    .eq("user_id", user.id)
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
  const user = session.user;

  const { data } = await supabase
    .from("skill_gaps")
    .select("skill_name, frequency")
    .eq("user_id", user.id)
    .order("frequency", { ascending: false })
    .limit(10);

  return (data || []).map((g) => ({
    name: g.skill_name,
    freq: g.frequency,
  }));
}
