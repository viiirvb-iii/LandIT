/**
 * Resume refinement utilities ported from Resume-Matcher.
 *
 * 1. AI phrase removal (deterministic, no LLM)
 * 2. Word-boundary keyword matching
 * 3. Hallucination detection (master alignment check)
 * 4. Keyword gap analysis (injectable vs non-injectable)
 * 5. Multi-pass refinement orchestration
 */

import { callClaude, parseJsonResponse } from "./claude.ts";
import { INJECT_KEYWORDS_PROMPT } from "./prompts.ts";

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
  // Extended list from Resume-Matcher
  facilitated: "helped",
  cultivated: "built",
  galvanized: "motivated",
  championed: "supported",
  "fast-paced": "busy",
  "high-impact": "significant",
  "cross-functional": "",
  "stakeholder engagement": "communication",
  "synergistic": "combined",
  "paradigm shift": "change",
  "scalable solutions": "solutions",
  "robust framework": "framework",
  "holistic approach": "approach",
  "deliverables": "results",
  "bandwidth": "capacity",
  "ecosystem": "system",
  "end-to-end": "full",
  "best practices": "standards",
  "mission-critical": "important",
  "world-class": "excellent",
  "bleeding-edge": "new",
  "disruptive": "innovative",
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

/* ── Keyword Gap Analysis ── */

export interface KeywordGapAnalysis {
  missing_keywords: string[];
  injectable_keywords: string[];
  non_injectable_keywords: string[];
  current_match_pct: number;
  potential_match_pct: number;
}

/**
 * Analyze keyword gaps between resume and job description.
 * Classifies missing keywords as injectable (present in master resume) vs non-injectable.
 */
export function analyzeKeywordGaps(
  resumeText: string,
  masterResumeText: string,
  jobKeywords: string[]
): KeywordGapAnalysis {
  const { matched, missing, score: currentPct } = calculateKeywordMatch(
    resumeText,
    jobKeywords
  );

  const injectable: string[] = [];
  const nonInjectable: string[] = [];

  for (const kw of missing) {
    if (keywordInText(kw, masterResumeText)) {
      injectable.push(kw);
    } else {
      nonInjectable.push(kw);
    }
  }

  const potentialMatched = matched.length + injectable.length;
  const potentialPct = jobKeywords.length > 0
    ? Math.round((potentialMatched / jobKeywords.length) * 100)
    : 0;

  return {
    missing_keywords: missing,
    injectable_keywords: injectable,
    non_injectable_keywords: nonInjectable,
    current_match_pct: currentPct,
    potential_match_pct: potentialPct,
  };
}

/**
 * Inject missing keywords into resume data via LLM.
 * Only injects keywords that are present in the master resume (injectable).
 */
export async function injectKeywords(
  resumeData: Record<string, unknown>,
  injectableKeywords: string[],
  jobDescription: string
): Promise<{ result: Record<string, unknown>; injectedCount: number }> {
  if (injectableKeywords.length === 0) {
    return { result: resumeData, injectedCount: 0 };
  }

  const truncatedJd = jobDescription.slice(0, 2000);

  const prompt = `${INJECT_KEYWORDS_PROMPT}

<resume_data>
${JSON.stringify(resumeData, null, 2)}
</resume_data>

<injectable_keywords>
${injectableKeywords.join(", ")}
</injectable_keywords>

<job_description>
${truncatedJd}
</job_description>

Naturally weave the injectable keywords into the resume content. Return the full modified resume JSON.`;

  try {
    const response = await callClaude(
      "You are a resume keyword optimizer. Return ONLY valid JSON.",
      [{ type: "text", text: prompt }],
      8192
    );

    const result = parseJsonResponse(response) as Record<string, unknown>;

    // Validate the result has the same structure
    const requiredKeys = ["experience", "skills"];
    const hasRequired = requiredKeys.some((k) => k in result);
    if (!hasRequired) {
      console.error("Keyword injection returned invalid structure, using original");
      return { result: resumeData, injectedCount: 0 };
    }

    return { result, injectedCount: injectableKeywords.length };
  } catch (e) {
    console.error("Keyword injection failed:", e);
    return { result: resumeData, injectedCount: 0 };
  }
}

/* ── Multi-Pass Refinement ── */

export interface RefinementConfig {
  enable_keyword_injection: boolean;
  enable_ai_phrase_removal: boolean;
  enable_master_alignment: boolean;
  max_passes: number;
}

export interface RefinementResult {
  refined_data: Record<string, unknown>;
  passes_completed: number;
  keyword_analysis: KeywordGapAnalysis | null;
  keywords_injected: number;
  ai_phrases_removed: number;
  alignment_violations: number;
  final_match_pct: number;
}

/**
 * Run multi-pass refinement pipeline on resume data.
 */
export async function runRefinementPipeline(
  resumeData: Record<string, unknown>,
  masterResumeText: string,
  jobKeywords: string[],
  jobDescription: string,
  config: RefinementConfig
): Promise<RefinementResult> {
  let data = structuredClone(resumeData);
  let totalPhrasesRemoved = 0;
  let totalKeywordsInjected = 0;
  let totalViolations = 0;
  let keywordAnalysis: KeywordGapAnalysis | null = null;
  const maxPasses = Math.min(Math.max(config.max_passes, 1), 5);

  for (let pass = 0; pass < maxPasses; pass++) {
    const resumeText = extractAllText(data);

    // Pass 1: Keyword injection
    if (config.enable_keyword_injection) {
      keywordAnalysis = analyzeKeywordGaps(resumeText, masterResumeText, jobKeywords);
      if (keywordAnalysis.injectable_keywords.length > 0) {
        const { result, injectedCount } = await injectKeywords(
          data,
          keywordAnalysis.injectable_keywords,
          jobDescription
        );
        data = result;
        totalKeywordsInjected += injectedCount;
      }
    }

    // Pass 2: AI phrase removal
    if (config.enable_ai_phrase_removal) {
      const updatedText = extractAllText(data);
      const { removedCount } = removeAiPhrases(updatedText, jobDescription);
      totalPhrasesRemoved += removedCount;

      // Apply phrase removal to all text fields in the data
      data = removeAiPhrasesFromData(data, jobDescription);
    }

    // Pass 3: Master alignment check
    if (config.enable_master_alignment) {
      const skills = extractSkillNames(data);
      const companies = extractCompanyNames(data);
      const certs = extractCertNames(data);
      const { violations } = checkMasterAlignment(skills, companies, certs, masterResumeText);
      totalViolations += violations.length;
    }
  }

  const finalText = extractAllText(data);
  const { score: finalPct } = calculateKeywordMatch(finalText, jobKeywords);

  return {
    refined_data: data,
    passes_completed: maxPasses,
    keyword_analysis: keywordAnalysis,
    keywords_injected: totalKeywordsInjected,
    ai_phrases_removed: totalPhrasesRemoved,
    alignment_violations: totalViolations,
    final_match_pct: finalPct,
  };
}

/* ── Text Extraction Helpers ── */

/**
 * Recursively extract all text from resume JSON for matching.
 */
function extractAllText(data: Record<string, unknown>): string {
  const parts: string[] = [];

  if (data.summary) parts.push(String(data.summary));

  const exp = (data.experience || data.workExperience || []) as Array<Record<string, unknown>>;
  for (const e of exp) {
    if (e.title) parts.push(String(e.title));
    if (e.company) parts.push(String(e.company));
    const bullets = (e.bullets || e.description || []) as string[];
    parts.push(...bullets.map(String));
  }

  const edu = (data.education || []) as Array<Record<string, unknown>>;
  for (const e of edu) {
    if (e.degree) parts.push(String(e.degree));
    if (e.institution) parts.push(String(e.institution));
  }

  const skills = (data.skills || []) as Array<unknown>;
  for (const s of skills) {
    if (typeof s === "string") parts.push(s);
    else if (s && typeof s === "object" && "name" in s) parts.push(String((s as { name: string }).name));
  }

  const projects = (data.projects || data.personalProjects || []) as Array<Record<string, unknown>>;
  for (const p of projects) {
    if (p.name) parts.push(String(p.name));
    if (p.description) {
      if (Array.isArray(p.description)) parts.push(...p.description.map(String));
      else parts.push(String(p.description));
    }
  }

  const certs = (data.certifications || []) as string[];
  parts.push(...certs.map(String));

  if (data.additional && typeof data.additional === "object") {
    const add = data.additional as Record<string, unknown>;
    if (add.technicalSkills) parts.push(...(add.technicalSkills as string[]).map(String));
    if (add.languages) parts.push(...(add.languages as string[]).map(String));
  }

  return parts.join(" ");
}

function extractSkillNames(data: Record<string, unknown>): string[] {
  const skills = (data.skills || []) as Array<unknown>;
  return skills.map((s) => {
    if (typeof s === "string") return s;
    if (s && typeof s === "object" && "name" in s) return String((s as { name: string }).name);
    return "";
  }).filter(Boolean);
}

function extractCompanyNames(data: Record<string, unknown>): string[] {
  const exp = (data.experience || data.workExperience || []) as Array<Record<string, unknown>>;
  return exp.map((e) => String(e.company || "")).filter(Boolean);
}

function extractCertNames(data: Record<string, unknown>): string[] {
  return ((data.certifications || []) as string[]).map(String).filter(Boolean);
}

/**
 * Apply AI phrase removal to all text fields in resume data structure.
 */
function removeAiPhrasesFromData(
  data: Record<string, unknown>,
  jobDescription: string
): Record<string, unknown> {
  const result = structuredClone(data);

  if (result.summary && typeof result.summary === "string") {
    result.summary = removeAiPhrases(result.summary, jobDescription).cleaned;
  }

  const exp = (result.experience || result.workExperience || []) as Array<Record<string, unknown>>;
  for (const e of exp) {
    const bullets = (e.bullets || e.description || []) as string[];
    const cleaned = bullets.map((b) => removeAiPhrases(String(b), jobDescription).cleaned);
    if (e.bullets) e.bullets = cleaned;
    else if (e.description) e.description = cleaned;
  }

  const projects = (result.projects || result.personalProjects || []) as Array<Record<string, unknown>>;
  for (const p of projects) {
    if (p.description && Array.isArray(p.description)) {
      p.description = p.description.map((d: unknown) =>
        removeAiPhrases(String(d), jobDescription).cleaned
      );
    }
  }

  return result;
}

/* ── Helpers ── */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
