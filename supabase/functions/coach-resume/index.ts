import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";
import { getEmbedding } from "../_shared/embeddings.ts";
import { validateCoachOutput } from "../_shared/validation.ts";
import { sanitizeInput } from "../_shared/sanitizer.ts";

const COACH_SYSTEM_PROMPT = `You are a resume coach. You have the user's ACTUAL resume and the ACTUAL job posting.

Every suggestion you make MUST:
1. Reference a SPECIFIC line or section from <resume> — quote it exactly in "resume_section".
2. Cite a SPECIFIC requirement from <job> — quote it in "job_requirement".
3. NEVER suggest adding skills, experience, or achievements the user does not have.
4. You may suggest REPHRASING existing content to better match job language.
5. For genuine skill gaps (skills in <skill_analysis> missing list): be HONEST. Do not pretend the user has them. Instead, suggest actionable ways to address the gap (courses, side projects, certifications).
6. Any metrics or numbers in your "after" text MUST exist in the original resume.

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "title": "short title for the suggestion",
      "icon": "emoji",
      "icon_bg": "#hex color",
      "resume_section": "exact quoted text from the resume this applies to",
      "job_requirement": "exact quoted text from the job posting",
      "insight": "what's wrong and why it matters",
      "why": "deeper explanation of why this change is important",
      "before": "current text from the resume (exact quote)",
      "after": "suggested improved version (grounded in resume facts)",
      "reasoning": "how this connects the resume to the job requirement",
      "ats_points": 0
    }
  ],
  "genuine_gaps": [
    {
      "skill": "skill name",
      "importance": "how important it is for this role",
      "suggestion": "actionable way to address this gap"
    }
  ],
  "overall_ats_score": 0,
  "questions": [
    "follow-up question based on actual resume content to clarify or improve coaching"
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id, user_answers } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch parsed resume
    const { data: resume } = await supabase
      .from("parsed_resumes")
      .select("parsed_data, skills_extracted, raw_text")
      .eq("user_id", user.id)
      .single();

    if (!resume) {
      return new Response(
        JSON.stringify({ error: "No parsed resume found. Upload your resume first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1b. Fetch user profile for coaching context
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, degree, university, year, preferred_fields, preferred_locations")
      .eq("id", user.id)
      .single();

    // 2. Fetch job data
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b. If job has sparse data, synthesize a description from available fields
    if (!job.description && !job.about) {
      const parts = [`Role: ${job.role || job.title || "Unknown"}`];
      if (job.company) parts.push(`Company: ${job.company}`);
      if (job.location) parts.push(`Location: ${job.location}`);
      if (job.job_type) parts.push(`Type: ${job.job_type}`);
      if (job.field) parts.push(`Field: ${job.field}`);
      if (job.industry) parts.push(`Industry: ${job.industry}`);
      if (job.raw_description) {
        job.description = job.raw_description;
      } else {
        job.description = parts.join(". ") + ". Provide general coaching for this type of role based on common industry requirements.";
      }
    }
    if (!job.skill_matches || job.skill_matches.length === 0) {
      // Try to extract from skills_required or job_description_fields
      if (job.skills_required) {
        try {
          const parsed = typeof job.skills_required === "string"
            ? JSON.parse(job.skills_required)
            : job.skills_required;
          job.skill_matches = Array.isArray(parsed) ? parsed : [];
        } catch { /* ignore */ }
      }
    }

    // 3. Deterministic skill matching
    const resumeSkills = new Set(
      (resume.skills_extracted || []).map((s: string) => s.toLowerCase())
    );
    const jobSkills: string[] = (job.skill_matches || []).map(
      (s: { name?: string; skill?: string }) =>
        (s.name || s.skill || "").toLowerCase()
    );
    const matched = jobSkills.filter((s) => resumeSkills.has(s));
    const missing = jobSkills.filter((s) => !resumeSkills.has(s));
    const matchPct = Math.round(
      (matched.length / Math.max(jobSkills.length, 1)) * 100
    );

    // 4. Semantic retrieval - find most relevant resume chunks for this job
    let relevantChunks: Array<{ chunk_text: string; section_label: string }> = [];
    try {
      const jobText = `${job.role} ${job.description || ""} ${job.about || ""}`;
      const jobEmbedding = await getEmbedding(jobText.slice(0, 8000));

      const { data: chunks } = await supabase.rpc("match_resume_chunks", {
        query_embedding: jobEmbedding,
        match_user_id: user.id,
        match_count: 5,
      });

      if (chunks) {
        relevantChunks = chunks;
      }
    } catch (e) {
      console.error("Semantic retrieval failed:", e);
    }

    // 5. Build grounded context
    // Sanitize user answers to prevent prompt injection
    const sanitizedAnswers = user_answers
      ? JSON.parse(sanitizeInput(JSON.stringify(user_answers)))
      : null;
    const userAnswersSection = sanitizedAnswers
      ? `\n<user_answers>\nThe user provided these additional details during Q&A:\n${JSON.stringify(sanitizedAnswers, null, 2)}\n</user_answers>`
      : "";

    const profileSection = profile
      ? `\n<user_profile>\nName: ${profile.full_name || "Unknown"}\nDegree: ${profile.degree || "Not specified"}\nUniversity: ${profile.university || "Not specified"}\nYear: ${profile.year || "Not specified"}\nPreferred roles: ${(profile.preferred_fields || []).join(", ") || "Not specified"}\nPreferred locations: ${(profile.preferred_locations || []).join(", ") || "Not specified"}\n</user_profile>`
      : "";

    const contextMessage = `<resume>
<structured>
${JSON.stringify(resume.parsed_data, null, 2)}
</structured>
<relevant_sections>
${relevantChunks.map((c) => `[${c.section_label}] ${c.chunk_text}`).join("\n\n---\n\n")}
</relevant_sections>
<raw_text>
${(resume.raw_text || "").slice(0, 6000)}
</raw_text>
</resume>

<job>
Title: ${job.role}
Company: ${job.company}
Location: ${job.location || ""}
Type: ${job.job_type || ""}
Description: ${job.description || ""}
About: ${job.about || ""}
Requirements: ${JSON.stringify(job.requirements || [])}
Required Skills: ${JSON.stringify(job.skill_matches || [])}
</job>

<skill_analysis>
Matched skills: [${matched.join(", ")}]
Missing skills: [${missing.join(", ")}]
Match percentage: ${matchPct}%
</skill_analysis>
${userAnswersSection}
${profileSection}

Provide coaching suggestions to improve this resume for the job above. Consider the user's background and career stage when making suggestions. Generate 3-5 specific, actionable suggestions. Each suggestion must cite exact text from the resume and job posting. Be honest about genuine gaps.`;

    const claudeResponse = await callClaude(
      COACH_SYSTEM_PROMPT,
      [{ type: "text", text: contextMessage }],
      8192
    );

    let coachResult: Record<string, unknown>;
    try {
      coachResult = parseJsonResponse(claudeResponse) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: claudeResponse.slice(0, 500) }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Post-processing validation
    const validation = validateCoachOutput(
      coachResult as Parameters<typeof validateCoachOutput>[0],
      resume.raw_text || "",
      job.description || ""
    );

    if (validation.warnings.length > 0) {
      (coachResult as Record<string, unknown>).validation_warnings =
        validation.warnings;
    }

    // 7. Store coaching session
    const totalPoints = (
      (coachResult.suggestions as Array<{ ats_points: number }>) || []
    ).reduce((sum, s) => sum + (s.ats_points || 0), 0);

    await supabase.from("coaching_sessions").insert({
      user_id: user.id,
      job_id,
      mode: "existing",
      initial_score: matchPct,
      final_score: matchPct + totalPoints,
      changes_total: (
        (coachResult.suggestions as unknown[]) || []
      ).length,
      answers: user_answers || {},
    });

    return new Response(
      JSON.stringify({
        success: true,
        result: coachResult,
        skill_analysis: { matched, missing, match_percentage: matchPct },
        validation,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("coach-resume error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
