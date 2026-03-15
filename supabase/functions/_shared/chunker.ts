export interface Chunk {
  text: string;
  index: number;
  sectionLabel: string;
}

const SECTION_PATTERNS = [
  { pattern: /\b(experience|work history|employment)\b/i, label: "experience" },
  { pattern: /\b(education|academic|degree|university)\b/i, label: "education" },
  { pattern: /\b(skills|technologies|tech stack|proficiencies)\b/i, label: "skills" },
  { pattern: /\b(projects|portfolio)\b/i, label: "projects" },
  { pattern: /\b(certifications?|licenses?)\b/i, label: "certifications" },
  { pattern: /\b(summary|objective|profile|about)\b/i, label: "summary" },
];

function detectSection(text: string): string {
  for (const { pattern, label } of SECTION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return "other";
}

export function chunkText(
  rawText: string,
  chunkSize = 500,
  overlap = 50
): Chunk[] {
  const chunks: Chunk[] = [];

  // Split by double newlines first (natural paragraph breaks)
  const paragraphs = rawText.split(/\n{2,}/);
  let buffer = "";
  let currentSection = "other";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect section from paragraph headings
    const detected = detectSection(trimmed);
    if (detected !== "other") currentSection = detected;

    if (buffer.length + trimmed.length > chunkSize && buffer.length > 0) {
      chunks.push({
        text: buffer.trim(),
        index: chunkIndex++,
        sectionLabel: currentSection,
      });

      // Keep overlap from end of previous chunk
      const overlapText = buffer.slice(-overlap);
      buffer = overlapText + "\n" + trimmed;
    } else {
      buffer += (buffer ? "\n" : "") + trimmed;
    }
  }

  // Push remaining buffer
  if (buffer.trim()) {
    chunks.push({
      text: buffer.trim(),
      index: chunkIndex,
      sectionLabel: currentSection,
    });
  }

  return chunks;
}
