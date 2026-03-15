import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getEmbedding } from "../_shared/embeddings.ts";
import { matchResumeToJob } from "../_shared/tfidf.ts";

/**
 * Resume-Matcher style scoring endpoint.
 * Combines:
 * 1. TF-IDF cosine similarity (keyword-level matching)
 * 2. Semantic vector similarity (meaning-level matching via pgvector)
 * 3. Deterministic skill intersection
 * 4. Section-level analysis
 *
 * Returns a comprehensive match report for a resume against a job.
 */
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
    const { data: resume } = await supabase
      .from("parsed_resumes")
      .select("parsed_data, skills_extracted, raw_text")
      .eq("user_id", user.id)
      .single();

    if (!resume) {
      return new Response(
        JSON.stringify({ error: "No parsed resume. Upload your resume first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Fetch user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("degree, university, year, preferred_fields, preferred_locations")
      .eq("id", user.id)
      .single();

    // 3. Fetch job
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

    // 4. Build section texts from parsed resume for section-level scoring
    const parsedData = resume.parsed_data as Record<string, unknown>;
    const sectionTexts: Record<string, string> = {};

    if (parsedData.experience) {
      sectionTexts.experience = (parsedData.experience as Array<Record<string, unknown>>)
        .map((e) =>
          `${e.title} ${e.company} ${(e.bullets as string[] || []).join(" ")} ${(e.skills_mentioned as string[] || []).join(" ")}`
        )
        .join(" ");
    }
    if (parsedData.education) {
      sectionTexts.education = (parsedData.education as Array<Record<string, unknown>>)
        .map((e) => `${e.degree} ${e.institution} ${e.year}`)
        .join(" ");
    }
    if (parsedData.skills) {
      sectionTexts.skills = (parsedData.skills as string[]).join(" ");
    }
    if (parsedData.projects) {
      sectionTexts.projects = (parsedData.projects as Array<Record<string, unknown>>)
        .map((p) =>
          `${p.name} ${p.description} ${(p.technologies as string[] || []).join(" ")}`
        )
        .join(" ");
    }

    // 5. Job description text
    const jobText = [
      job.role,
      job.description || "",
      job.about || "",
      (job.bullets || []).join(" "),
      JSON.stringify(job.requirements || []),
      (job.skill_matches || [])
        .map((s: { name?: string }) => s.name || "")
        .join(" "),
    ].join(" ");

    // 6. TF-IDF matching (Resume-Matcher style)
    const tfidfResult = matchResumeToJob(
      resume.raw_text || JSON.stringify(parsedData),
      jobText,
      sectionTexts
    );

    // 7. Semantic vector similarity (via pgvector)
    let semanticScore = 0;
    try {
      const jobEmbedding = await getEmbedding(jobText.slice(0, 8000));
      const { data: chunks } = await supabase.rpc("match_resume_chunks", {
        query_embedding: jobEmbedding,
        match_user_id: user.id,
        match_count: 5,
      });

      if (chunks && chunks.length > 0) {
        // Average similarity of top 5 chunks
        semanticScore = Math.round(
          (chunks.reduce(
            (sum: number, c: { similarity: number }) => sum + c.similarity,
            0
          ) /
            chunks.length) *
            100
        );
      }
    } catch (e) {
      console.error("Semantic scoring failed:", e);
    }

    // 8. Deterministic skill matching
    const resumeSkills = new Set(
      (resume.skills_extracted || []).map((s: string) => s.toLowerCase())
    );
    const jobSkills: string[] = (job.skill_matches || []).map(
      (s: { name?: string; skill?: string }) =>
        (s.name || s.skill || "").toLowerCase()
    );
    const matchedSkills = jobSkills.filter((s) => resumeSkills.has(s));
    const missingSkills = jobSkills.filter((s) => !resumeSkills.has(s));
    const skillMatchPct = jobSkills.length > 0
      ? Math.round((matchedSkills.length / jobSkills.length) * 100)
      : 0;

    // 9. Location & preference matching
    let locationMatch = false;
    if (profile?.preferred_locations && job.location) {
      const jobLoc = job.location.toLowerCase();
      locationMatch = (profile.preferred_locations as string[]).some(
        (loc: string) => jobLoc.includes(loc.toLowerCase())
      );
    }

    let roleMatch = false;
    if (profile?.preferred_fields && job.role) {
      const jobRole = job.role.toLowerCase();
      roleMatch = (profile.preferred_fields as string[]).some(
        (field: string) => jobRole.includes(field.toLowerCase().split(" ")[0])
      );
    }

    // 10. Composite score (weighted)
    // 30% TF-IDF, 25% semantic, 30% skill match, 10% location, 5% role preference
    const compositeScore = Math.min(
      100,
      Math.round(
        tfidfResult.overall_score * 0.3 +
          semanticScore * 0.25 +
          skillMatchPct * 0.3 +
          (locationMatch ? 10 : 0) +
          (roleMatch ? 5 : 0)
      )
    );

    return new Response(
      JSON.stringify({
        success: true,
        composite_score: compositeScore,
        breakdown: {
          tfidf_score: tfidfResult.overall_score,
          tfidf_similarity: tfidfResult.tfidf_similarity,
          semantic_score: semanticScore,
          skill_match_pct: skillMatchPct,
          keyword_match_pct: tfidfResult.keyword_match_pct,
          location_match: locationMatch,
          role_match: roleMatch,
        },
        skills: {
          matched: matchedSkills,
          missing: missingSkills,
          resume_skills: Array.from(resumeSkills),
        },
        keywords: {
          matched: tfidfResult.matched_keywords,
          missing: tfidfResult.missing_keywords,
          job_top: tfidfResult.job_top_keywords.slice(0, 10),
          resume_top: tfidfResult.resume_top_keywords.slice(0, 10),
        },
        section_scores: tfidfResult.section_scores,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("match-resume error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
