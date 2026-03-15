/**
 * Post-processing validation for RAG output.
 * Checks that LLM-generated content is grounded in source data.
 */

interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export function validateTailoredOutput(
  output: {
    tailored_sections?: Array<{ tailored: string }>;
    changes_made?: Array<{ source_in_resume: string }>;
  },
  resumeSkills: string[],
  jobSkills: string[],
  rawResumeText: string
): ValidationResult {
  const warnings: string[] = [];
  const allAllowedSkills = new Set(
    [...resumeSkills, ...jobSkills].map((s) => s.toLowerCase())
  );

  // Check that source_in_resume fields actually exist in the resume
  if (output.changes_made) {
    for (const change of output.changes_made) {
      if (
        change.source_in_resume &&
        !rawResumeText
          .toLowerCase()
          .includes(change.source_in_resume.toLowerCase().slice(0, 30))
      ) {
        warnings.push(
          `Source citation may be fabricated: "${change.source_in_resume.slice(0, 50)}..."`
        );
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}

export function validateCoachOutput(
  output: {
    suggestions?: Array<{
      resume_section: string;
      job_requirement: string;
    }>;
  },
  rawResumeText: string,
  jobDescription: string
): ValidationResult {
  const warnings: string[] = [];

  if (output.suggestions) {
    for (const sug of output.suggestions) {
      // Verify resume_section actually appears in the resume
      if (
        sug.resume_section &&
        !rawResumeText
          .toLowerCase()
          .includes(sug.resume_section.toLowerCase().slice(0, 30))
      ) {
        warnings.push(
          `Resume section may be fabricated: "${sug.resume_section.slice(0, 50)}..."`
        );
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}
