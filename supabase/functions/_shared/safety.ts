/**
 * Post-processing safety preservations ported from Resume-Matcher.
 * Ensures LLM output doesn't corrupt critical resume data.
 */

// deno-lint-ignore no-explicit-any
type ResumeData = Record<string, any>;

/**
 * Restore personal info from original if LLM modified it.
 * Blocks changes to: name, email, phone, location, linkedin, github, website.
 */
export function preservePersonalInfo(
  original: ResumeData,
  tailored: ResumeData
): ResumeData {
  const result = structuredClone(tailored);
  const origContact = original.contact || original.personalInfo || {};
  const fields = [
    "name",
    "email",
    "phone",
    "location",
    "linkedin",
    "github",
    "website",
    "title",
  ];

  if (result.contact) {
    for (const f of fields) {
      if (origContact[f] !== undefined) {
        result.contact[f] = origContact[f];
      }
    }
  }
  if (result.personalInfo) {
    for (const f of fields) {
      if (origContact[f] !== undefined) {
        result.personalInfo[f] = origContact[f];
      }
    }
  }

  return result;
}

/**
 * Restore skills that the LLM dropped during tailoring.
 * Only allows additions, never removals.
 */
export function preserveOriginalSkills(
  original: ResumeData,
  tailored: ResumeData
): { result: ResumeData; restoredCount: number } {
  const result = structuredClone(tailored);
  let restoredCount = 0;

  // Handle skills array
  const origSkills: Array<{ name: string }> = original.skills || [];
  const tailoredSkills: Array<{ name: string }> = result.skills || [];
  const tailoredNames = new Set(
    tailoredSkills.map((s) => (typeof s === "string" ? s : s.name || "").toLowerCase())
  );

  for (const skill of origSkills) {
    const name = typeof skill === "string" ? skill : skill.name || "";
    if (name && !tailoredNames.has(name.toLowerCase())) {
      tailoredSkills.push(skill);
      restoredCount++;
    }
  }
  result.skills = tailoredSkills;

  // Handle certifications
  const origCerts: string[] = original.certifications || [];
  const tailoredCerts: string[] = result.certifications || [];
  const certSet = new Set(tailoredCerts.map((c) => c.toLowerCase()));

  for (const cert of origCerts) {
    if (!certSet.has(cert.toLowerCase())) {
      tailoredCerts.push(cert);
      restoredCount++;
    }
  }
  result.certifications = tailoredCerts;

  // Handle additional.technicalSkills if present
  if (original.additional?.technicalSkills && result.additional) {
    const origTech: string[] = original.additional.technicalSkills || [];
    const tailoredTech: string[] = result.additional.technicalSkills || [];
    const techSet = new Set(tailoredTech.map((t) => t.toLowerCase()));

    for (const tech of origTech) {
      if (!techSet.has(tech.toLowerCase())) {
        tailoredTech.push(tech);
        restoredCount++;
      }
    }
    result.additional.technicalSkills = tailoredTech;
  }

  return { result, restoredCount };
}

/**
 * Recover month-precision dates that LLM truncated to year-only.
 * E.g., if original has "March 2023 - August 2024" but LLM output has "2023 - 2024",
 * restore the original date string.
 */
export function restoreDates(
  original: ResumeData,
  tailored: ResumeData
): { result: ResumeData; restoredCount: number } {
  const result = structuredClone(tailored);
  let restoredCount = 0;

  const MONTH_PATTERN =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;

  function hasMonthPrecision(dateStr: string): boolean {
    return MONTH_PATTERN.test(dateStr || "");
  }

  function restoreEntry(
    origEntry: ResumeData,
    tailoredEntry: ResumeData
  ): void {
    const dateFields = [
      "start_date",
      "end_date",
      "years",
      "date",
      "year",
      "duration",
    ];
    for (const field of dateFields) {
      if (
        origEntry[field] &&
        tailoredEntry[field] &&
        hasMonthPrecision(String(origEntry[field])) &&
        !hasMonthPrecision(String(tailoredEntry[field]))
      ) {
        tailoredEntry[field] = origEntry[field];
        restoredCount++;
      }
    }
  }

  // Restore dates in experience
  const origExp = (original.experience || original.workExperience || []) as ResumeData[];
  const tailoredExp = (result.experience || result.workExperience || []) as ResumeData[];
  for (let i = 0; i < Math.min(origExp.length, tailoredExp.length); i++) {
    restoreEntry(origExp[i], tailoredExp[i]);
  }

  // Restore dates in education
  const origEdu = (original.education || []) as ResumeData[];
  const tailoredEdu = (result.education || []) as ResumeData[];
  for (let i = 0; i < Math.min(origEdu.length, tailoredEdu.length); i++) {
    restoreEntry(origEdu[i], tailoredEdu[i]);
  }

  // Restore dates in projects
  const origProj = (original.projects || original.personalProjects || []) as ResumeData[];
  const tailoredProj = (result.projects || result.personalProjects || []) as ResumeData[];
  for (let i = 0; i < Math.min(origProj.length, tailoredProj.length); i++) {
    restoreEntry(origProj[i], tailoredProj[i]);
  }

  return { result, restoredCount };
}

/**
 * Remove sections from tailored resume that don't exist in original.
 * Prevents LLM from hallucinating entire new sections.
 */
export function protectCustomSections(
  original: ResumeData,
  tailored: ResumeData
): { result: ResumeData; removedSections: string[] } {
  const result = structuredClone(tailored);
  const removedSections: string[] = [];

  const originalKeys = new Set(Object.keys(original));

  for (const key of Object.keys(result)) {
    if (
      !originalKeys.has(key) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !["validation_warnings", "ai_phrases_removed"].includes(key)
    ) {
      delete result[key];
      removedSections.push(key);
    }
  }

  return { result, removedSections };
}
