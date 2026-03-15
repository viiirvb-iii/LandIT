import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";
import { sanitizeInput } from "../_shared/sanitizer.ts";
import {
  COVER_LETTER_PROMPT,
  OUTREACH_PROMPT,
  TITLE_PROMPT,
} from "../_shared/prompts.ts";

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

    const { job_id, action, language, user_edits } = await req.json();

    if (!job_id || !action) {
      return new Response(
        JSON.stringify({ error: "job_id and action required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Fetch parsed resume
    const { data: resume } = await supabase
      .from("parsed_resumes")
      .select("parsed_data, skills_extracted, raw_text")
      .eq("user_id", user.id)
      .single();

    if (!resume) {
      return new Response(
        JSON.stringify({
          error: "No parsed resume found. Upload your resume first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Fetch job
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

    // 3. Build context
    const jobDesc = sanitizeInput(
      job.description || job.about || job.raw_description || `${job.role} at ${job.company}`
    );
    const resumeText = sanitizeInput(
      (resume.raw_text || JSON.stringify(resume.parsed_data)).slice(0, 6000)
    );

    // 4. Select prompt based on action
    let systemPrompt: string;
    let contentType: string;
    let maxTokens: number;

    switch (action) {
      case "cover_letter":
        systemPrompt = COVER_LETTER_PROMPT;
        contentType = "cover_letter";
        maxTokens = 2048;
        break;
      case "outreach":
        systemPrompt = OUTREACH_PROMPT;
        contentType = "outreach";
        maxTokens = 1024;
        break;
      case "title":
        systemPrompt = TITLE_PROMPT;
        contentType = "title";
        maxTokens = 128;
        break;
      default:
        return new Response(
          JSON.stringify({
            error: "Invalid action. Use: cover_letter, outreach, or title",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    // 5. Build user message
    const langInstruction = language && language !== "en"
      ? `\nIMPORTANT: Write the output in ${language}.`
      : "";

    const editInstruction = user_edits
      ? `\n\nUser requested changes: ${sanitizeInput(user_edits)}`
      : "";

    const userMessage = `<resume>
${resumeText}
</resume>

<job>
Title: ${job.role || job.title || ""}
Company: ${job.company || ""}
Location: ${job.location || ""}
Description: ${jobDesc}
Requirements: ${JSON.stringify(job.requirements || [])}
Skills: ${JSON.stringify(job.skill_matches || job.skills_required || [])}
</job>
${langInstruction}${editInstruction}

Generate the requested content based on the resume and job posting above.`;

    // 6. Call Claude
    const claudeResponse = await callClaude(
      systemPrompt,
      [{ type: "text", text: userMessage }],
      maxTokens
    );

    let result: Record<string, unknown>;
    try {
      result = parseJsonResponse(claudeResponse) as Record<string, unknown>;
    } catch {
      // If JSON parsing fails, use raw text as content
      result = { [contentType]: claudeResponse, title: `${job.role} @ ${job.company}` };
    }

    // 7. Extract the content text
    const contentText = String(
      result.cover_letter || result.outreach || result.title || result.content || claudeResponse
    );

    // 8. Store in cover_letters table
    // Check for existing entry to increment version
    const { data: existing } = await supabase
      .from("cover_letters")
      .select("version")
      .eq("user_id", user.id)
      .eq("job_id", job_id)
      .eq("content_type", contentType)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersion = (existing?.version || 0) + 1;

    const { error: insertError } = await supabase
      .from("cover_letters")
      .insert({
        user_id: user.id,
        job_id,
        content_type: contentType,
        content: contentText,
        language: language || "en",
        version: newVersion,
      });

    if (insertError) {
      console.error("Failed to store cover letter:", insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_type: contentType,
        content: contentText,
        title: result.title || result.subject_line || `${job.role} @ ${job.company}`,
        version: newVersion,
        full_result: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const e = err as Error;
    console.error("generate-cover-letter error:", e?.message);
    return new Response(
      JSON.stringify({
        error: "Internal error",
        details: e?.message || String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
