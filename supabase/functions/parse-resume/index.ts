import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";
import { getEmbeddings } from "../_shared/embeddings.ts";
import { chunkText } from "../_shared/chunker.ts";

const PARSE_SYSTEM_PROMPT = `You are a resume parser. Extract ONLY information that is explicitly stated in this resume.
Do NOT infer, guess, or add any information that is not written in the document.
If a field has no corresponding content in the resume, use null or an empty array.

For each skill, estimate a proficiency level (0-100) based on:
- How prominently it appears (mentioned once vs. used in multiple roles)
- Whether it's listed as a primary skill or mentioned in passing
- Years of apparent experience with it

Return ONLY valid JSON with this exact structure:
{
  "contact": { "name": "", "email": "", "phone": "", "location": "" },
  "summary": "verbatim or near-verbatim summary if present, else null",
  "experience": [
    {
      "title": "",
      "company": "",
      "start_date": "",
      "end_date": "",
      "duration_months": 0,
      "bullets": ["exact bullet points from resume"],
      "skills_mentioned": ["only skills explicitly in this section"]
    }
  ],
  "education": [
    { "degree": "", "institution": "", "year": "", "gpa": "" }
  ],
  "skills": [
    { "name": "skill name", "level": 80, "category": "language|framework|tool|soft_skill|database|cloud|other" }
  ],
  "certifications": ["only if listed"],
  "projects": [
    { "name": "", "description": "", "technologies": [] }
  ],
  "total_experience_months": 0,
  "career_level": "student|junior|mid|senior|lead"
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

    // Get the user from the JWT
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { storage_path } = await req.json();
    if (!storage_path) {
      return new Response(
        JSON.stringify({ error: "storage_path is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(storage_path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download file", details: downloadError?.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Determine file type and prepare for Claude
    const isPdf = storage_path.toLowerCase().endsWith(".pdf");
    let rawText = "";
    let claudeContent: Parameters<typeof callClaude>[1];

    if (isPdf) {
      // Send PDF as base64 document to Claude (native PDF support)
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );
      claudeContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        },
        {
          type: "text",
          text: "Parse this resume and extract all information into the JSON structure specified. Also provide the full plain text of the resume in your response after the JSON, delimited by ===RAWTEXT=== markers.",
        },
      ];
    } else {
      // TXT or other text formats
      rawText = await fileData.text();
      claudeContent = [
        {
          type: "text",
          text: `Parse this resume and extract all information into the JSON structure specified.\n\n<resume>\n${rawText}\n</resume>`,
        },
      ];
    }

    // 3. Call Claude to extract structured data
    const claudeResponse = await callClaude(
      PARSE_SYSTEM_PROMPT,
      claudeContent,
      8192
    );

    // 4. Parse the JSON response
    let parsedData: Record<string, unknown>;
    let responseText = claudeResponse;

    // If PDF, try to extract raw text from the response
    if (isPdf) {
      const rawTextMarker = "===RAWTEXT===";
      const parts = claudeResponse.split(rawTextMarker);
      if (parts.length >= 3) {
        responseText = parts[0];
        rawText = parts[1].trim();
      } else {
        // Fallback: use the structured extraction as the text representation
        responseText = claudeResponse;
      }
    }

    try {
      parsedData = parseJsonResponse(responseText) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse Claude response as JSON", raw: responseText.slice(0, 500) }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Extract flat skills list + skill details from all sources in parsed data
    const skillsMap = new Map<string, { level: number; category: string }>();

    // Primary skills (with levels from Claude)
    const skills = (parsedData.skills as Array<{ name: string; level: number; category: string }>) || [];
    for (const s of skills) {
      if (typeof s === "string") {
        skillsMap.set(s, { level: 70, category: "other" });
      } else if (s.name) {
        skillsMap.set(s.name, { level: s.level || 70, category: s.category || "other" });
      }
    }

    // Skills from experience sections
    const experience = (parsedData.experience as Array<{ skills_mentioned?: string[] }>) || [];
    for (const exp of experience) {
      if (exp.skills_mentioned) {
        for (const s of exp.skills_mentioned) {
          if (!skillsMap.has(s)) {
            skillsMap.set(s, { level: 60, category: "other" });
          }
        }
      }
    }

    // Skills from projects
    const projects = (parsedData.projects as Array<{ technologies?: string[] }>) || [];
    for (const proj of projects) {
      if (proj.technologies) {
        for (const s of proj.technologies) {
          if (!skillsMap.has(s)) {
            skillsMap.set(s, { level: 50, category: "other" });
          }
        }
      }
    }

    const skillsExtracted = Array.from(skillsMap.keys());

    // If we still don't have raw text (PDF without markers), reconstruct from structured data
    if (!rawText && parsedData) {
      rawText = JSON.stringify(parsedData, null, 2);
    }

    // 6. Chunk the raw text for embedding
    const chunks = chunkText(rawText);

    // 7. Generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddings(chunkTexts);

    // 8. Store everything in Supabase (using service role for writes)

    // Delete existing data for this user (re-parse scenario)
    await supabase
      .from("resume_chunks")
      .delete()
      .eq("user_id", user.id);

    // Upsert parsed resume
    const { error: upsertError } = await supabase
      .from("parsed_resumes")
      .upsert(
        {
          user_id: user.id,
          storage_path,
          parsed_data: parsedData,
          skills_extracted: skillsExtracted,
          raw_text: rawText,
          parsed_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return new Response(
        JSON.stringify({ error: "Failed to store parsed resume", details: upsertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insert chunks with embeddings
    if (chunks.length > 0) {
      const chunkRows = chunks.map((c, i) => ({
        user_id: user.id,
        chunk_text: c.text,
        chunk_index: c.index,
        section_label: c.sectionLabel,
        embedding: embeddings[i],
      }));

      const { error: chunksError } = await supabase
        .from("resume_chunks")
        .insert(chunkRows);

      if (chunksError) {
        console.error("Failed to insert chunks:", chunksError);
      }
    }

    // 9. Auto-populate user_skills from extracted skills with levels
    if (skillsMap.size > 0) {
      const skillRows = Array.from(skillsMap.entries()).map(
        ([name, { level }]) => ({
          user_id: user.id,
          skill_name: name,
          level,
          tag: (level >= 70 ? "strong" : level >= 40 ? "ok" : "gap") as
            | "strong"
            | "ok"
            | "gap",
        })
      );

      // Upsert to avoid duplicates
      await supabase
        .from("user_skills")
        .upsert(skillRows, { onConflict: "user_id,skill_name" });
    }

    // 10. Update profile resume_updated_at
    await supabase
      .from("profiles")
      .update({
        resume_url: storage_path,
        resume_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        skills_count: skillsExtracted.length,
        chunks_count: chunks.length,
        parsed_data: parsedData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("parse-resume error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
