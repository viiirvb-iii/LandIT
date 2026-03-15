import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";
import { sanitizeInput } from "../_shared/sanitizer.ts";
import {
  ENRICH_ANALYZE_PROMPT,
  ENRICH_ENHANCE_PROMPT,
  ENRICH_REGENERATE_PROMPT,
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

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action required (analyze, enhance, apply, regenerate)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch parsed resume (needed for all actions)
    const { data: resume } = await supabase
      .from("parsed_resumes")
      .select("parsed_data, raw_text")
      .eq("user_id", user.id)
      .single();

    if (!resume) {
      return new Response(
        JSON.stringify({ error: "No parsed resume found. Upload your resume first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Route to action handler
    switch (action) {
      case "analyze":
        return await handleAnalyze(supabase, user.id, resume);
      case "enhance":
        return await handleEnhance(supabase, user.id, resume, body);
      case "apply":
        return await handleApply(supabase, user.id, resume, body);
      case "regenerate":
        return await handleRegenerate(supabase, user.id, resume, body);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: analyze, enhance, apply, regenerate" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: unknown) {
    const e = err as Error;
    console.error("enrich-resume error:", e?.message);
    return new Response(
      JSON.stringify({ error: "Internal error", details: e?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/* ── Analyze: Find weak descriptions & generate questions ── */

// deno-lint-ignore no-explicit-any
async function handleAnalyze(supabase: any, userId: string, resume: any) {
  const parsedData = resume.parsed_data;

  const userMessage = `<resume>
${JSON.stringify(parsedData, null, 2)}
</resume>

Analyze this resume for weak descriptions in Experience and Projects sections.
Identify items with generic language, missing metrics, or vague scope.
Generate up to 6 targeted questions to gather specific details from the user.`;

  const response = await callClaude(
    ENRICH_ANALYZE_PROMPT,
    [{ type: "text", text: userMessage }],
    4096
  );

  let result: Record<string, unknown>;
  try {
    result = parseJsonResponse(response) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse analysis", raw: response.slice(0, 500) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Store enrichment session
  const { data: session, error: sessionErr } = await supabase
    .from("enrichment_sessions")
    .insert({
      user_id: userId,
      status: "questions_ready",
      weak_items: result.weak_items || [],
      questions: result.questions || [],
    })
    .select("id")
    .single();

  if (sessionErr) {
    console.error("Failed to store enrichment session:", sessionErr);
  }

  return new Response(
    JSON.stringify({
      success: true,
      session_id: session?.id,
      weak_items: result.weak_items || [],
      questions: result.questions || [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/* ── Enhance: Generate improved bullets from user answers ── */

// deno-lint-ignore no-explicit-any
async function handleEnhance(supabase: any, userId: string, resume: any, body: any) {
  const { session_id, answers } = body;

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return new Response(
      JSON.stringify({ error: "answers array required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const parsedData = resume.parsed_data;

  // Sanitize user answers
  const sanitizedAnswers = answers.map(
    (a: { question_id: string; item_id: string; answer: string }) => ({
      ...a,
      answer: sanitizeInput(a.answer),
    })
  );

  const userMessage = `<resume>
${JSON.stringify(parsedData, null, 2)}
</resume>

<user_answers>
${JSON.stringify(sanitizedAnswers, null, 2)}
</user_answers>

Generate enhanced bullet points based on the user's answers.
Preserve all original bullets and ADD 2-4 new ones per item.`;

  const response = await callClaude(
    ENRICH_ENHANCE_PROMPT,
    [{ type: "text", text: userMessage }],
    4096
  );

  let result: Record<string, unknown>;
  try {
    result = parseJsonResponse(response) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse enhancements", raw: response.slice(0, 500) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update enrichment session
  if (session_id) {
    await supabase
      .from("enrichment_sessions")
      .update({
        status: "enhancing",
        answers: sanitizedAnswers,
        enhancements: result.enhancements || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", session_id)
      .eq("user_id", userId);
  }

  return new Response(
    JSON.stringify({
      success: true,
      enhancements: result.enhancements || [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/* ── Apply: Merge enhancements into master resume ── */

// deno-lint-ignore no-explicit-any
async function handleApply(supabase: any, userId: string, resume: any, body: any) {
  const { session_id, enhancements } = body;

  if (!enhancements || !Array.isArray(enhancements)) {
    return new Response(
      JSON.stringify({ error: "enhancements array required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const parsedData = structuredClone(resume.parsed_data) as Record<string, unknown>;
  let appliedCount = 0;

  for (const enh of enhancements) {
    const { item_id, item_type, new_bullets } = enh;
    if (!new_bullets || !Array.isArray(new_bullets)) continue;

    // Find matching item in parsed data and append new bullets
    const sections = item_type === "project"
      ? (parsedData.projects || parsedData.personalProjects || []) as Array<Record<string, unknown>>
      : (parsedData.experience || parsedData.workExperience || []) as Array<Record<string, unknown>>;

    for (const section of sections) {
      if (
        section.id === item_id ||
        String(section.title || section.name || "")
          .toLowerCase()
          .includes(String(enh.title || "").toLowerCase())
      ) {
        const bulletsKey = section.bullets ? "bullets" : "description";
        const existing = (section[bulletsKey] || []) as string[];
        section[bulletsKey] = [...existing, ...new_bullets];
        appliedCount++;
        break;
      }
    }
  }

  // Update parsed_resumes with enriched data
  const { error: updateErr } = await supabase
    .from("parsed_resumes")
    .update({
      parsed_data: parsedData,
      parsed_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) {
    return new Response(
      JSON.stringify({ error: "Failed to update resume", details: updateErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update enrichment session
  if (session_id) {
    await supabase
      .from("enrichment_sessions")
      .update({
        status: "complete",
        updated_at: new Date().toISOString(),
      })
      .eq("id", session_id)
      .eq("user_id", userId);
  }

  return new Response(
    JSON.stringify({
      success: true,
      applied_count: appliedCount,
      parsed_data: parsedData,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/* ── Regenerate: Bulk rewrite items based on instruction ── */

// deno-lint-ignore no-explicit-any
async function handleRegenerate(supabase: any, userId: string, resume: any, body: any) {
  const { items, instruction } = body;

  if (!items || !Array.isArray(items) || !instruction) {
    return new Response(
      JSON.stringify({ error: "items array and instruction required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sanitizedInstruction = sanitizeInput(instruction).slice(0, 2000);
  const parsedData = resume.parsed_data;

  // Build items context
  const itemsContext = items.map((item: { item_id: string; item_type: string; title: string }) => {
    const sections = item.item_type === "project"
      ? (parsedData.projects || parsedData.personalProjects || [])
      : (parsedData.experience || parsedData.workExperience || []);

    const found = sections.find(
      (s: Record<string, unknown>) =>
        s.id === item.item_id ||
        String(s.title || s.name || "")
          .toLowerCase()
          .includes(String(item.title || "").toLowerCase())
    );

    return {
      item_id: item.item_id,
      item_type: item.item_type,
      title: found?.title || found?.name || item.title,
      subtitle: found?.company || found?.role || "",
      current_content: found?.bullets || found?.description || [],
    };
  });

  const userMessage = `<items_to_regenerate>
${JSON.stringify(itemsContext, null, 2)}
</items_to_regenerate>

<instruction>
${sanitizedInstruction}
</instruction>

Rewrite these items according to the user's instruction. Keep titles and dates unchanged.`;

  const response = await callClaude(
    ENRICH_REGENERATE_PROMPT,
    [{ type: "text", text: userMessage }],
    4096
  );

  let result: Record<string, unknown>;
  try {
    result = parseJsonResponse(response) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to parse regeneration", raw: response.slice(0, 500) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      regenerated: result.regenerated || [],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
