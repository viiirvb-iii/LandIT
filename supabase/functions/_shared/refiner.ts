/**
 * Resume refinement utilities ported from Resume-Matcher.
 *
 * 1. AI phrase removal (deterministic, no LLM)
 * 2. Word-boundary keyword matching
 * 3. Hallucination detection (master alignment check)
 */

/* ── AI Phrase Removal ── */

const AI_PHRASE_REPLACEMENTS: Record<string, string> = {
  // Action verbs
  spearheaded: "led",
  orchestrated: "organized",
  synergized: "combined",
  leveraged: "used",
  revolutionized: "improved",
  pioneered: "started",
  streamlined: "simplified",
  conceptualized: "designed",
  operationalized: "implemented",
  incentivized: "motivated",
  // Corporate buzzwords
  "cutting-edge": "modern",
  "best-in-class": "top",
  "game-changing": "significant",
  "thought leader": "expert",
  "value-add": "benefit",
  "move the needle": "make progress",
  "circle back": "follow up",
  "deep dive": "detailed review",
  "low-hanging fruit": "quick win",
  // Filler phrases
  "in order to": "to",
  "moving forward": "",
  "at the end of the day": "",
  "it goes without saying": "",
  "needless to say": "",
  "as a matter of fact": "",
  "for all intents and purposes": "",
  "in terms of": "for",
  "with respect to": "about",
  "in the process of": "",
  // AI giveaways
  "i successfully": "I",
  "i effectively": "I",
  "i skillfully": "I",
  "i strategically": "I",
  "i proactively": "I",
  "i diligently": "I",
  "i meticulously": "I",
  "i passionately": "I",
  "results-driven": "",
  "detail-oriented": "",
  "self-motivated": "",
  "team player": "",
  "proven track record": "experience",
  "dynamic environment": "",
};

/**
 * Remove common AI-generated buzzwords from text.
 * Protects phrases that appear in the job description (keeps them).
 */
export function removeAiPhrases(
  text: string,
  jobDescription = ""
): { cleaned: string; removedCount: number } {
  const jdLower = jobDescription.toLowerCase();
  let cleaned = text;
  let removedCount = 0;

  for (const [phrase, replacement] of Object.entries(AI_PHRASE_REPLACEMENTS)) {
    // Don't remove if the job description uses this phrase
    if (jdLower.includes(phrase.toLowerCase())) continue;

    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    const before = cleaned;
    cleaned = cleaned.replace(regex, replacement);
    if (cleaned !== before) removedCount++;
  }

  // Clean up double spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return { cleaned, removedCount };
}

/* ── Word-Boundary Keyword Matching ── */

/**
 * Check if a keyword exists in text using word boundaries.
 * Prevents false positives like "python" matching "pythonic".
 */
export function keywordInText(keyword: string, text: string): boolean {
  const escaped = escapeRegex(keyword);
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

/**
 * Calculate keyword match percentage using word-boundary matching.
 * More accurate than simple set intersection.
 */
export function calculateKeywordMatch(
  resumeText: string,
  keywords: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (!keywords.length) return { score: 0, matched: [], missing: [] };

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (keywordInText(kw, resumeText)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  return {
    score: Math.round((matched.length / keywords.length) * 100),
    matched,
    missing,
  };
}

/* ── Hallucination Detection (Master Alignment) ── */

interface AlignmentViolation {
  field: string;
  value: string;
  severity: "critical" | "info";
  message: string;
}

/**
 * Check tailored resume against master resume for fabricated content.
 * Detects: fake skills, fake companies, fake certifications.
 */
export function checkMasterAlignment(
  tailoredSkills: string[],
  tailoredCompanies: string[],
  tailoredCerts: string[],
  masterResumeText: string
): { violations: AlignmentViolation[]; clean: boolean } {
  const violations: AlignmentViolation[] = [];

  // Check skills
  for (const skill of tailoredSkills) {
    if (!keywordInText(skill, masterResumeText)) {
      violations.push({
        field: "skill",
        value: skill,
        severity: "critical",
        message: `Skill "${skill}" not found in original resume — may be fabricated`,
      });
    }
  }

  // Check company names
  for (const company of tailoredCompanies) {
    if (!keywordInText(company, masterResumeText)) {
      violations.push({
        field: "company",
        value: company,
        severity: "critical",
        message: `Company "${company}" not found in original resume — may be fabricated`,
      });
    }
  }

  // Check certifications
  for (const cert of tailoredCerts) {
    const certWords = cert.split(/\s+/).filter((w) => w.length > 3);
    const foundAny = certWords.some((w) => keywordInText(w, masterResumeText));
    if (!foundAny) {
      violations.push({
        field: "certification",
        value: cert,
        severity: "critical",
        message: `Certification "${cert}" not found in original resume — may be fabricated`,
      });
    }
  }

  return { violations, clean: violations.length === 0 };
}

/* ── Helpers ── */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
