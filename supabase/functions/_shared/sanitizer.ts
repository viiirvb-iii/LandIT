/**
 * Prompt injection sanitization for user-provided text.
 * Strips known injection patterns before text enters any LLM prompt.
 */

const INJECTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Direct instruction overrides
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/gi, replacement: "[REDACTED]" },
  { pattern: /disregard\s+(all\s+)?previous\s+(instructions|rules|prompts)/gi, replacement: "[REDACTED]" },
  { pattern: /forget\s+(everything|all|your)\s+(above|previous|instructions)/gi, replacement: "[REDACTED]" },
  // Role manipulation
  { pattern: /you\s+are\s+now\b/gi, replacement: "[REDACTED]" },
  { pattern: /act\s+as\s+(a|an|if)\b/gi, replacement: "[REDACTED]" },
  { pattern: /pretend\s+(to\s+be|you\s+are)/gi, replacement: "[REDACTED]" },
  { pattern: /from\s+now\s+on\s+(you|act|behave)/gi, replacement: "[REDACTED]" },
  // System/role tags
  { pattern: /<\/?system>/gi, replacement: "" },
  { pattern: /<\/?assistant>/gi, replacement: "" },
  { pattern: /<\/?user>/gi, replacement: "" },
  { pattern: /<\|im_start\|>/gi, replacement: "" },
  { pattern: /<\|im_end\|>/gi, replacement: "" },
  { pattern: /\[INST\]/gi, replacement: "" },
  { pattern: /\[\/INST\]/gi, replacement: "" },
  // Override markers at line start
  { pattern: /^IMPORTANT:\s*/gim, replacement: "" },
  { pattern: /^OVERRIDE:\s*/gim, replacement: "" },
  { pattern: /^SYSTEM:\s*/gim, replacement: "" },
  { pattern: /^INSTRUCTION:\s*/gim, replacement: "" },
  // Separator injection
  { pattern: /\n{2,}---+\n/g, replacement: "\n" },
  // Base64/encoded payload markers
  { pattern: /base64\s*:\s*[A-Za-z0-9+/=]{50,}/g, replacement: "[REDACTED]" },
];

/**
 * Sanitize user-provided text to remove prompt injection attempts.
 * Returns cleaned text safe for inclusion in LLM prompts.
 */
export function sanitizeInput(text: string): string {
  if (!text) return text;

  let cleaned = text;
  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Remove excessive whitespace from redactions
  cleaned = cleaned.replace(/\[REDACTED\]\s*\[REDACTED\]/g, "[REDACTED]");
  cleaned = cleaned.replace(/\s{3,}/g, "  ");

  return cleaned.trim();
}
