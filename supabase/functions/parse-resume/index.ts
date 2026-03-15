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

/** Extract readable text from a PDF binary using basic parsing */
function extractPdfText(bytes: Uint8Array): string {
  // Decode the raw bytes to a string (PDF is mostly ASCII with binary streams)
  const raw = new TextDecoder("latin1").decode(bytes);

  const textParts: string[] = [];

  // Method 1: Extract text between BT...ET blocks (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract strings in parentheses: (text here)
    const parenRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = parenRegex.exec(block)) !== null) {
      const text = strMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (text.trim()) textParts.push(text);
    }
    // Extract hex strings: <hex>
    const hexRegex = /<([0-9a-fA-F]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(block)) !== null) {
      const hex = hexMatch[1];
      let text = "";
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substring(i, i + 2), 16);
        if (code >= 32 && code < 127) text += String.fromCharCode(code);
      }
      if (text.trim()) textParts.push(text);
    }
  }

  // Method 2: If BT/ET extraction got nothing, try stream decompression
  if (textParts.length === 0) {
    // Fallback: just extract any readable ASCII runs from the file
    const asciiRegex = /[\x20-\x7E]{4,}/g;
    let asciiMatch;
    const seen = new Set<string>();
    while ((asciiMatch = asciiRegex.exec(raw)) !== null) {
      const text = asciiMatch[0].trim();
      // Skip PDF commands and binary-looking content
      if (text.length > 5 && !text.match(/^[\d\s.]+$/) && !text.match(/^[A-Z]{1,3}\s/) && !seen.has(text)) {
        // Skip common PDF keywords
        if (!/^(endobj|endstream|stream|xref|trailer|startxref|obj|\d+ \d+ obj)/.test(text)) {
          seen.add(text);
          textParts.push(text);
        }
      }
    }
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

/** Safe base64 encoding that works on any file size by processing in chunks. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(storage_path);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download file", details: downloadError?.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Extract text from the file
    const isPdf = storage_path.toLowerCase().endsWith(".pdf");
    let rawText = "";

    if (isPdf) {
      // Send PDF as base64 document using Anthropic's native document block.
      // Use chunked encoding — spreading a large Uint8Array crashes the runtime.
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
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
          text: "Parse this resume and extract all information into the JSON structure specified. Return ONLY the JSON object — no extra text.",
        },
      ];
    } else {
      rawText = await fileData.text();
    }

    // 3. Call Claude to extract structured data
    const claudeResponse = await callClaude(
      PARSE_SYSTEM_PROMPT,
      [{ type: "text", text: `Parse this resume and extract all information into the JSON structure specified.\n\n<resume>\n${rawText}\n</resume>` }],
      8192
    );

    // 4. Parse the JSON response
    let parsedData: Record<string, unknown>;

    try {
      parsedData = parseJsonResponse(claudeResponse) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse Claude response as JSON", raw: claudeResponse.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Extract skills from all sources
    const skillsMap = new Map<string, { level: number; category: string }>();

    const skills = (parsedData.skills as Array<{ name: string; level: number; category: string }>) || [];
    for (const s of skills) {
      if (typeof s === "string") {
        skillsMap.set(s, { level: 70, category: "other" });
      } else if (s.name) {
        skillsMap.set(s.name, { level: s.level || 70, category: s.category || "other" });
      }
    }

    const experience = (parsedData.experience as Array<{ skills_mentioned?: string[] }>) || [];
    for (const exp of experience) {
      if (exp.skills_mentioned) {
        for (const s of exp.skills_mentioned) {
          if (!skillsMap.has(s)) skillsMap.set(s, { level: 60, category: "other" });
        }
      }
    }

    const projects = (parsedData.projects as Array<{ technologies?: string[] }>) || [];
    for (const proj of projects) {
      if (proj.technologies) {
        for (const s of proj.technologies) {
          if (!skillsMap.has(s)) skillsMap.set(s, { level: 50, category: "other" });
        }
      }
    }

    const skillsExtracted = Array.from(skillsMap.keys());

    // 6. Chunk the raw text for embedding
    const chunks = chunkText(rawText);
    const chunkTexts = chunks.map((c) => c.text);

    // 7. Generate embeddings (skip if no chunks to avoid empty API call)
    let embeddings: number[][] = [];
    if (chunkTexts.length > 0) {
      try {
        embeddings = await getEmbeddings(chunkTexts);
      } catch (embErr) {
        console.error("Embeddings failed (non-blocking):", embErr);
        // Continue without embeddings — skills + parsed data are more important
      }
    }

    // 8. Store in Supabase (service role bypasses RLS)
    await supabase.from("resume_chunks").delete().eq("user_id", user.id);

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert chunks with embeddings (only if embeddings succeeded)
    if (chunks.length > 0 && embeddings.length === chunks.length) {
      const chunkRows = chunks.map((c, i) => ({
        user_id: user.id,
        chunk_text: c.text,
        chunk_index: c.index,
        section_label: c.sectionLabel,
        embedding: embeddings[i],
      }));
      const { error: chunksError } = await supabase.from("resume_chunks").insert(chunkRows);
      if (chunksError) console.error("Chunks insert failed:", chunksError);
    }

    // 9. Auto-populate user_skills
    if (skillsMap.size > 0) {
      const skillRows = Array.from(skillsMap.entries()).map(([name, { level }]) => ({
        user_id: user.id,
        skill_name: name,
        level,
        tag: (level >= 70 ? "strong" : level >= 40 ? "ok" : "gap") as "strong" | "ok" | "gap",
      }));
      await supabase.from("user_skills").upsert(skillRows, { onConflict: "user_id,skill_name" });
    }

    // 10. Update profile
    await supabase
      .from("profiles")
      .update({ resume_url: storage_path, resume_updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        skills_count: skillsExtracted.length,
        chunks_count: chunks.length,
        parsed_data: parsedData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const e = err as Error;
    console.error("parse-resume error:", e?.message, e?.stack);
    return new Response(
      JSON.stringify({ error: "Internal error", details: e?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
