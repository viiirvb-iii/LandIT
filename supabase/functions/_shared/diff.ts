/**
 * Diff calculation between original and tailored resumes.
 * Ported from Resume-Matcher's diff logic.
 */

export interface FieldDiff {
  field_path: string;
  field_type: "skill" | "description" | "certification" | "education" | "project" | "summary";
  change_type: "added" | "removed" | "modified";
  original_value: string;
  new_value: string;
  confidence: "high" | "medium" | "low";
}

export interface DiffSummary {
  total_changes: number;
  skills_added: number;
  skills_removed: number;
  descriptions_modified: number;
  certifications_added: number;
  high_risk_changes: number;
}

export interface DiffResult {
  summary: DiffSummary;
  changes: FieldDiff[];
}

// deno-lint-ignore no-explicit-any
type ResumeData = Record<string, any>;

/**
 * Simple string similarity ratio (0-1) based on common character sequences.
 */
function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Count matching 2-grams
  const getNgrams = (s: string, n: number): Set<string> => {
    const grams = new Set<string>();
    for (let i = 0; i <= s.length - n; i++) {
      grams.add(s.substring(i, i + n));
    }
    return grams;
  };

  const aGrams = getNgrams(aLower, 2);
  const bGrams = getNgrams(bLower, 2);
  if (aGrams.size === 0 && bGrams.size === 0) return 1;

  let intersection = 0;
  for (const g of aGrams) {
    if (bGrams.has(g)) intersection++;
  }

  return (2 * intersection) / (aGrams.size + bGrams.size);
}

function toStringArray(arr: unknown[]): string[] {
  return arr.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "name" in item)
      return String((item as { name: string }).name);
    return String(item);
  });
}

/**
 * Calculate granular diff between original and tailored resume data.
 */
export function calculateDiff(
  original: ResumeData,
  tailored: ResumeData
): DiffResult {
  const changes: FieldDiff[] = [];

  // 1. Compare summary
  const origSummary = String(original.summary || "");
  const tailSummary = String(tailored.summary || "");
  if (origSummary !== tailSummary && tailSummary) {
    const sim = similarityRatio(origSummary, tailSummary);
    changes.push({
      field_path: "summary",
      field_type: "summary",
      change_type: origSummary ? "modified" : "added",
      original_value: origSummary,
      new_value: tailSummary,
      confidence: sim > 0.7 ? "high" : sim > 0.4 ? "medium" : "low",
    });
  }

  // 2. Compare skills
  const origSkills = toStringArray(original.skills || []);
  const tailSkills = toStringArray(tailored.skills || []);
  const origSkillSet = new Set(origSkills.map((s) => s.toLowerCase()));
  const tailSkillSet = new Set(tailSkills.map((s) => s.toLowerCase()));

  for (const skill of tailSkills) {
    if (!origSkillSet.has(skill.toLowerCase())) {
      changes.push({
        field_path: `skills[${skill}]`,
        field_type: "skill",
        change_type: "added",
        original_value: "",
        new_value: skill,
        confidence: "high",
      });
    }
  }
  for (const skill of origSkills) {
    if (!tailSkillSet.has(skill.toLowerCase())) {
      changes.push({
        field_path: `skills[${skill}]`,
        field_type: "skill",
        change_type: "removed",
        original_value: skill,
        new_value: "",
        confidence: "high",
      });
    }
  }

  // 3. Compare experience bullets
  const origExp = (original.experience || original.workExperience || []) as ResumeData[];
  const tailExp = (tailored.experience || tailored.workExperience || []) as ResumeData[];

  for (let i = 0; i < Math.max(origExp.length, tailExp.length); i++) {
    const origEntry = origExp[i];
    const tailEntry = tailExp[i];

    if (!origEntry && tailEntry) {
      changes.push({
        field_path: `experience[${i}]`,
        field_type: "description",
        change_type: "added",
        original_value: "",
        new_value: tailEntry.title || `Experience ${i}`,
        confidence: "low",
      });
      continue;
    }
    if (origEntry && !tailEntry) {
      changes.push({
        field_path: `experience[${i}]`,
        field_type: "description",
        change_type: "removed",
        original_value: origEntry.title || `Experience ${i}`,
        new_value: "",
        confidence: "high",
      });
      continue;
    }
    if (!origEntry || !tailEntry) continue;

    const origBullets: string[] = origEntry.bullets || origEntry.description || [];
    const tailBullets: string[] = tailEntry.bullets || tailEntry.description || [];

    for (let j = 0; j < Math.max(origBullets.length, tailBullets.length); j++) {
      const origB = origBullets[j] || "";
      const tailB = tailBullets[j] || "";

      if (!origB && tailB) {
        changes.push({
          field_path: `experience[${i}].bullets[${j}]`,
          field_type: "description",
          change_type: "added",
          original_value: "",
          new_value: tailB,
          confidence: "medium",
        });
      } else if (origB && !tailB) {
        changes.push({
          field_path: `experience[${i}].bullets[${j}]`,
          field_type: "description",
          change_type: "removed",
          original_value: origB,
          new_value: "",
          confidence: "high",
        });
      } else if (origB !== tailB) {
        const sim = similarityRatio(origB, tailB);
        changes.push({
          field_path: `experience[${i}].bullets[${j}]`,
          field_type: "description",
          change_type: "modified",
          original_value: origB,
          new_value: tailB,
          confidence: sim > 0.6 ? "high" : sim > 0.3 ? "medium" : "low",
        });
      }
    }
  }

  // 4. Compare certifications
  const origCerts: string[] = (original.certifications || []).map(String);
  const tailCerts: string[] = (tailored.certifications || []).map(String);
  const origCertSet = new Set(origCerts.map((c) => c.toLowerCase()));
  const tailCertSet = new Set(tailCerts.map((c) => c.toLowerCase()));

  for (const cert of tailCerts) {
    if (!origCertSet.has(cert.toLowerCase())) {
      changes.push({
        field_path: `certifications[${cert}]`,
        field_type: "certification",
        change_type: "added",
        original_value: "",
        new_value: cert,
        confidence: "high",
      });
    }
  }
  for (const cert of origCerts) {
    if (!tailCertSet.has(cert.toLowerCase())) {
      changes.push({
        field_path: `certifications[${cert}]`,
        field_type: "certification",
        change_type: "removed",
        original_value: cert,
        new_value: "",
        confidence: "high",
      });
    }
  }

  // 5. Compare projects
  const origProj = (original.projects || original.personalProjects || []) as ResumeData[];
  const tailProj = (tailored.projects || tailored.personalProjects || []) as ResumeData[];

  for (let i = 0; i < Math.max(origProj.length, tailProj.length); i++) {
    const origP = origProj[i];
    const tailP = tailProj[i];

    if (!origP && tailP) {
      changes.push({
        field_path: `projects[${i}]`,
        field_type: "project",
        change_type: "added",
        original_value: "",
        new_value: tailP.name || `Project ${i}`,
        confidence: "low",
      });
    } else if (origP && !tailP) {
      changes.push({
        field_path: `projects[${i}]`,
        field_type: "project",
        change_type: "removed",
        original_value: origP.name || `Project ${i}`,
        new_value: "",
        confidence: "high",
      });
    } else if (origP && tailP) {
      const origDesc = (origP.description || []).join(" ");
      const tailDesc = (tailP.description || []).join(" ");
      if (origDesc !== tailDesc) {
        const sim = similarityRatio(origDesc, tailDesc);
        changes.push({
          field_path: `projects[${i}].description`,
          field_type: "project",
          change_type: "modified",
          original_value: origDesc,
          new_value: tailDesc,
          confidence: sim > 0.6 ? "high" : sim > 0.3 ? "medium" : "low",
        });
      }
    }
  }

  // Build summary
  const summary: DiffSummary = {
    total_changes: changes.length,
    skills_added: changes.filter(
      (c) => c.field_type === "skill" && c.change_type === "added"
    ).length,
    skills_removed: changes.filter(
      (c) => c.field_type === "skill" && c.change_type === "removed"
    ).length,
    descriptions_modified: changes.filter(
      (c) => c.field_type === "description" && c.change_type === "modified"
    ).length,
    certifications_added: changes.filter(
      (c) => c.field_type === "certification" && c.change_type === "added"
    ).length,
    high_risk_changes: changes.filter((c) => c.confidence === "low").length,
  };

  return { summary, changes };
}
