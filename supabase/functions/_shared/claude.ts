// Uses OpenRouter to call Claude models
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

export async function callClaude(
  systemPrompt: string,
  userContent: Array<{ type: string; [key: string]: unknown }>,
  maxTokens = 4096
): Promise<string> {
  // Convert Anthropic-style content blocks to OpenAI-style
  const parts: Array<{ type: string; [key: string]: unknown }> = [];
  for (const block of userContent) {
    if (block.type === "text") {
      parts.push({ type: "text", text: block.text });
    } else if (block.type === "document" && block.source) {
      // PDF: send as base64 image-like content via OpenRouter
      const src = block.source as { data: string; media_type: string };
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${src.media_type};base64,${src.data}`,
        },
      });
      // Also add instruction text if not already present
    } else {
      // Pass through as text fallback
      parts.push({ type: "text", text: JSON.stringify(block) });
    }
  }

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://landed-app.vercel.app",
      "X-Title": "Landed App",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parts },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter Claude call failed: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}
