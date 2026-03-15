import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";
import { getEmbedding } from "../_shared/embeddings.ts";
import { validateTailoredOutput } from "../_shared/validation.ts";
import {
  removeAiPhrases,
  calculateKeywordMatch,
  checkMasterAlignment,
} from "../_shared/refiner.ts";

const TAILOR_SYSTEM_PROMPT = `You are a resume tailoring assistant. You have the user's ACTUAL resume and the ACTUAL job posting.

STRICT RULES:
1. ONLY reference skills, experience, and qualifications that appear in <resume>.
2. NEVER invent achievements, metrics, skills, company names, or job titles not in the resume.
3. You may REPHRASE existing bullet points to better match job posting language, but the underlying facts MUST come from the resume.
4. You may REORDER sections to prioritize the most relevant experience.
5. For missing skills listed in <skill_analysis>: only suggest adding if the user has CLOSELY RELATED experience (e.g., if they used "React" you can suggest mentioning "frontend frameworks"). Otherwise, list it as an honest gap.
6. If the resume genuinely lacks something the job requires, say so honestly in honest_gaps.
7. Any numbers, percentages, or metrics in your "tailored" text MUST exist in the original resume text.

Return ONLY valid JSON:
{
  "tailored_sections": [
    { "section": "experience|skills|summary|education", "original": "exact text from resume", "tailored": "improved version" }
  ],
  "changes_made": [
    { "what": "description of change", "why": "reason it helps", "source_in_resume": "exact quote from resume that supports this" }
  ],
  "ats_keywords_added": ["keyword1", "keyword2"],
  "ats_score_estimate": 0,
  "honest_gaps": ["skills or experience the user genuinely lacks for this role"]
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

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch parsed resume
    const { data: resume, error: resumeErr } = await supabase
      .from("parsed_resumes")
      .select("parsed_data, skills_extracted, raw_text")
      .eq("user_id", user.id)
      .single();

    if (resumeErr || !resume) {
      return new Response(
        JSON.stringify({ error: "No parsed resume found. Upload and parse your resume first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Fetch job data
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b. If job has sparse data, synthesize from available fields
    if (!job.description && !job.about) {
      if (job.raw_description) {
        job.description = job.raw_description;
      } else {
        const parts = [`Role: ${job.role || job.title || "Unknown"}`];
        if (job.company) parts.push(`Company: ${job.company}`);
        if (job.location) parts.push(`Location: ${job.location}`);
        if (job.job_type) parts.push(`Type: ${job.job_type}`);
        if (job.field) parts.push(`Field: ${job.field}`);
        job.description = parts.join(". ") + ". Tailor the resume for this type of role based on common industry requirements.";
      }
    }
    if (!job.skill_matches || job.skill_matches.length === 0) {
      if (job.skills_required) {
        try {
          const parsed = typeof job.skills_required === "string"
            ? JSON.parse(job.skills_required)
            : job.skills_required;
          job.skill_matches = Array.isArray(parsed) ? parsed : [];
        } catch { /* ignore */ }
      }
    }

    // 3. Deterministic skill matching using word-boundary matching (Resume-Matcher style)
    const resumeText = resume.raw_text || JSON.stringify(resume.parsed_data);
    const jobSkills: string[] = (job.skill_matches || []).map(
      (s: { name?: string; skill?: string }) =>
        (s.name || s.skill || "").toLowerCase()
    );

    const { score: matchPct, matched, missing } = calculateKeywordMatch(
      resumeText,
      jobSkills
    );

    // 4. Semantic retrieval - get relevant resume chunks
    let relevantChunks: string[] = [];
    try {
      const jobText = `${job.role} ${job.description || ""} ${job.about || ""}`;
      const jobEmbedding = await getEmbedding(jobText.slice(0, 8000));

      const { data: chunks } = await supabase.rpc("match_resume_chunks", {
        query_embedding: jobEmbedding,
        match_user_id: user.id,
        match_count: 5,
      });

      if (chunks) {
        relevantChunks = chunks.map(
          (c: { chunk_text: string }) => c.chunk_text
        );
      }
    } catch (e) {
      console.error("Semantic retrieval failed, using full resume:", e);
    }

    // 5. Assemble grounded context and call Claude
    const contextMessage = `<resume>
<structured>
${JSON.stringify(resume.parsed_data, null, 2)}
</structured>
<relevant_sections>
${relevantChunks.join("\n\n---\n\n")}
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

Tailor this resume for the job posting above. Follow all rules strictly.`;

    const claudeResponse = await callClaude(
      TAILOR_SYSTEM_PROMPT,
      [{ type: "text", text: contextMessage }],
      8192
    );

    let tailorResult: Record<string, unknown>;
    try {
      tailorResult = parseJsonResponse(claudeResponse) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: claudeResponse.slice(0, 500) }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Post-processing: AI phrase removal on tailored text (Resume-Matcher)
    const jobDesc = `${job.description || ""} ${job.about || ""} ${JSON.stringify(job.requirements || [])}`;
    let totalPhrasesRemoved = 0;

    const sections = (tailorResult.tailored_sections as Array<{ section: string; original: string; tailored: string }>) || [];
    for (const sec of sections) {
      if (sec.tailored) {
        const { cleaned, removedCount } = removeAiPhrases(sec.tailored, jobDesc);
        sec.tailored = cleaned;
        totalPhrasesRemoved += removedCount;
      }
    }

    // 7. Hallucination detection via master alignment check
    const tailoredSkills = (tailorResult.ats_keywords_added as string[]) || [];
    const tailoredCompanies: string[] = [];
    const tailoredCerts: string[] = [];

    // Extract company/cert names from parsed data for alignment check
    const parsedData = resume.parsed_data as Record<string, unknown>;
    if (parsedData) {
      const exp = (parsedData.experience as Array<{ company?: string }>) || [];
      for (const e of exp) {
        if (e.company) tailoredCompanies.push(e.company);
      }
      const certs = (parsedData.certifications as string[]) || [];
      tailoredCerts.push(...certs);
    }

    const alignment = checkMasterAlignment(
      tailoredSkills,
      tailoredCompanies,
      tailoredCerts,
      resumeText
    );

    // 8. Standard validation
    const validation = validateTailoredOutput(
      tailorResult as Parameters<typeof validateTailoredOutput>[0],
      resume.skills_extracted || [],
      jobSkills,
      resume.raw_text || ""
    );

    // Merge all warnings
    const allWarnings = [
      ...validation.warnings,
      ...alignment.violations.map((v) => v.message),
    ];

    if (allWarnings.length > 0) {
      (tailorResult as Record<string, unknown>).validation_warnings = allWarnings;
    }
    if (totalPhrasesRemoved > 0) {
      (tailorResult as Record<string, unknown>).ai_phrases_removed = totalPhrasesRemoved;
    }

    // 9. Store result in tailored_resumes table
    const atsScoreAfter =
      (tailorResult.ats_score_estimate as number) || matchPct;

    await supabase.from("tailored_resumes").insert({
      user_id: user.id,
      job_id,
      original_content: resume.raw_text || JSON.stringify(resume.parsed_data),
      tailored_content: JSON.stringify(tailorResult.tailored_sections),
      ats_score_before: matchPct,
      ats_score_after: atsScoreAfter,
      changes: tailorResult.changes_made || [],
    });

    // 10. Decrement ai_tailors_remaining
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_tailors_remaining")
      .eq("id", user.id)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          ai_tailors_remaining: Math.max(0, (profile.ai_tailors_remaining || 5) - 1),
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: tailorResult,
        skill_analysis: { matched, missing, match_percentage: matchPct },
        validation: validation,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("tailor-resume error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
