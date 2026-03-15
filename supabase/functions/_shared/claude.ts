import Anthropic from "npm:@anthropic-ai/sdk@^0.39.0";

const client = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

export async function callClaude(
  systemPrompt: string,
  userContent: Anthropic.MessageParam["content"],
  maxTokens = 4096
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20251001",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

export function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Find the outermost JSON object or array, ignoring any preamble/postamble
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
  const jsonEnd = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (jsonEnd >= 0 && jsonEnd < cleaned.length - 1) cleaned = cleaned.slice(0, jsonEnd + 1);

  return JSON.parse(cleaned);
}
