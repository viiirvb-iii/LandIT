/**
 * TF-IDF and keyword matching utilities.
 * Implements Resume-Matcher style analysis:
 * - Term frequency / inverse document frequency scoring
 * - Keyword extraction from job descriptions
 * - Cosine similarity between TF-IDF vectors
 */

// Common stop words to filter out
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "ought", "used", "this", "that", "these", "those", "i", "me", "my",
  "we", "our", "you", "your", "he", "she", "it", "they", "them",
  "what", "which", "who", "whom", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "about", "above", "after", "again",
  "also", "as", "because", "before", "between", "during", "if", "into",
  "over", "then", "through", "under", "until", "up", "while",
  "experience", "work", "working", "team", "role", "position", "job",
  "company", "required", "preferred", "strong", "ability", "including",
  "looking", "responsibilities", "requirements", "qualifications",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// Extract n-grams (1-grams and 2-grams)
function extractNgrams(tokens: string[]): string[] {
  const ngrams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    ngrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return ngrams;
}

// Compute term frequency for a document
function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length;
  for (const [term, count] of tf) {
    tf.set(term, count / len);
  }
  return tf;
}

// Compute IDF across two documents (resume + job description)
function computeIDF(
  docs: Map<string, number>[]
): Map<string, number> {
  const idf = new Map<string, number>();
  const N = docs.length;
  const allTerms = new Set<string>();

  for (const doc of docs) {
    for (const term of doc.keys()) {
      allTerms.add(term);
    }
  }

  for (const term of allTerms) {
    let docCount = 0;
    for (const doc of docs) {
      if (doc.has(term)) docCount++;
    }
    idf.set(term, Math.log(N / docCount) + 1);
  }
  return idf;
}

// Compute TF-IDF vector
function computeTFIDF(
  tf: Map<string, number>,
  idf: Map<string, number>
): Map<string, number> {
  const tfidf = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) || 1;
    tfidf.set(term, tfVal * idfVal);
  }
  return tfidf;
}

// Cosine similarity between two TF-IDF vectors
function cosineSimilarity(
  vec1: Map<string, number>,
  vec2: Map<string, number>
): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  const allTerms = new Set([...vec1.keys(), ...vec2.keys()]);

  for (const term of allTerms) {
    const v1 = vec1.get(term) || 0;
    const v2 = vec2.get(term) || 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Extract top keywords from a document based on TF-IDF scores
function extractTopKeywords(
  tfidf: Map<string, number>,
  topN = 20
): Array<{ keyword: string; score: number }> {
  return Array.from(tfidf.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([keyword, score]) => ({ keyword, score }));
}

export interface MatchResult {
  overall_score: number; // 0-100
  tfidf_similarity: number; // 0-1 cosine similarity
  keyword_match_pct: number; // percentage of job keywords found in resume
  matched_keywords: string[];
  missing_keywords: string[];
  resume_top_keywords: Array<{ keyword: string; score: number }>;
  job_top_keywords: Array<{ keyword: string; score: number }>;
  section_scores: Record<string, number>;
}

/**
 * Perform Resume-Matcher style analysis between a resume and job description.
 * Combines:
 * 1. TF-IDF cosine similarity (semantic relevance)
 * 2. Direct keyword matching (ATS compatibility)
 * 3. Section-level scoring
 */
export function matchResumeToJob(
  resumeText: string,
  jobDescription: string,
  resumeSections?: Record<string, string>
): MatchResult {
  // Tokenize and extract n-grams
  const resumeTokens = extractNgrams(tokenize(resumeText));
  const jobTokens = extractNgrams(tokenize(jobDescription));

  // Compute TF for each document
  const resumeTF = computeTF(resumeTokens);
  const jobTF = computeTF(jobTokens);

  // Compute IDF across both documents
  const idf = computeIDF([resumeTF, jobTF]);

  // Compute TF-IDF vectors
  const resumeTFIDF = computeTFIDF(resumeTF, idf);
  const jobTFIDF = computeTFIDF(jobTF, idf);

  // Cosine similarity
  const tfidfSimilarity = cosineSimilarity(resumeTFIDF, jobTFIDF);

  // Extract top keywords
  const jobTopKeywords = extractTopKeywords(jobTFIDF, 25);
  const resumeTopKeywords = extractTopKeywords(resumeTFIDF, 25);

  // Direct keyword matching (ATS-style)
  const resumeTokenSet = new Set(resumeTokens);
  const jobKeywordList = jobTopKeywords.map((k) => k.keyword);
  const matched = jobKeywordList.filter((k) => resumeTokenSet.has(k));
  const missing = jobKeywordList.filter((k) => !resumeTokenSet.has(k));
  const keywordMatchPct =
    jobKeywordList.length > 0
      ? Math.round((matched.length / jobKeywordList.length) * 100)
      : 0;

  // Section-level scoring (if sections provided)
  const sectionScores: Record<string, number> = {};
  if (resumeSections) {
    for (const [section, text] of Object.entries(resumeSections)) {
      if (!text) continue;
      const sectionTokens = extractNgrams(tokenize(text));
      const sectionTF = computeTF(sectionTokens);
      const sectionTFIDF = computeTFIDF(sectionTF, idf);
      sectionScores[section] = Math.round(
        cosineSimilarity(sectionTFIDF, jobTFIDF) * 100
      );
    }
  }

  // Overall score: weighted combination
  // 40% TF-IDF similarity + 60% keyword match (ATS weight is heavier)
  const overallScore = Math.round(
    tfidfSimilarity * 40 + (keywordMatchPct / 100) * 60
  );

  return {
    overall_score: Math.min(overallScore, 100),
    tfidf_similarity: Math.round(tfidfSimilarity * 1000) / 1000,
    keyword_match_pct: keywordMatchPct,
    matched_keywords: matched,
    missing_keywords: missing,
    resume_top_keywords: resumeTopKeywords,
    job_top_keywords: jobTopKeywords,
    section_scores: sectionScores,
  };
}
