const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callClaude(
  systemPrompt: string,
  userContent: unknown[] | string,
  maxTokens = 4096
): Promise<string> {
  // Convert Anthropic-style content blocks to a plain string for OpenRouter
  let content: string;
  if (typeof userContent === "string") {
    content = userContent;
  } else if (Array.isArray(userContent)) {
    content = userContent
      .filter((block: unknown) => (block as Record<string, unknown>).type === "text")
      .map((block: unknown) => (block as Record<string, string>).text)
      .join("\n");
  } else {
    content = String(userContent);
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip markdown code fences (handles ```json, ``` with any whitespace)
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?\s*```\s*$/, "").trim();

  // Find the outermost JSON object or array, ignoring any preamble/postamble
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
  const jsonEnd = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (jsonEnd >= 0 && jsonEnd < cleaned.length - 1) cleaned = cleaned.slice(0, jsonEnd + 1);

  return JSON.parse(cleaned);
}
