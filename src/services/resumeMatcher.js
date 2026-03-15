/**
 * Resume Matcher API service layer.
 *
 * Calls the local Resume-Matcher FastAPI backend (port 8000)
 * instead of Supabase Edge Functions for AI-heavy operations.
 */

const API_BASE = import.meta.env.VITE_RESUME_MATCHER_URL || 'http://localhost:8000/api/v1'

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `API error: ${res.status}`)
  }
  return res.json()
}

/* ── Resume Upload & Parsing ── */

export async function uploadResume(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/resumes/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export async function getResume(resumeId) {
  return api(`/resumes/${resumeId}`)
}

export async function listResumes() {
  return api('/resumes/list')
}

export async function getMasterResume() {
  const { resumes } = await listResumes()
  return resumes?.find((r) => r.is_master) || null
}

/* ── Job Description Upload ── */

export async function uploadJobDescription(content, resumeId = null) {
  return api('/jobs/upload', {
    method: 'POST',
    body: JSON.stringify({
      contents: [content],
      resume_id: resumeId,
    }),
  })
}

/* ── Resume Tailoring (improve) ── */

export async function tailorResumeForJob(resumeId, jobId, options = {}) {
  return api(`/resumes/${resumeId}/improve`, {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      prompt_id: options.promptId || 'professional',
    }),
  })
}

export async function previewTailoring(resumeId, jobId) {
  return api(`/resumes/${resumeId}/improve-preview`, {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId }),
  })
}

export async function confirmTailoring(resumeId, data) {
  return api(`/resumes/${resumeId}/improve-confirm`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/* ── Cover Letter & Outreach ── */

export async function generateCoverLetter(resumeId) {
  return api(`/resumes/${resumeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ generate_cover_letter: true }),
  })
}

export async function generateOutreachMessage(resumeId) {
  return api(`/resumes/${resumeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ generate_outreach_message: true }),
  })
}

/* ── PDF Export ── */

export async function downloadResumePdf(resumeId) {
  const res = await fetch(`${API_BASE}/resumes/${resumeId}/pdf`)
  if (!res.ok) throw new Error('PDF export failed')
  return res.blob()
}

export async function downloadCoverLetterPdf(resumeId) {
  const res = await fetch(`${API_BASE}/resumes/${resumeId}/cover-letter/pdf`)
  if (!res.ok) throw new Error('Cover letter PDF export failed')
  return res.blob()
}

/* ── Resume Enrichment (Q&A) ── */

export async function analyzeResume(resumeId) {
  return api(`/enrichment/analyze/${resumeId}`, { method: 'POST' })
}

export async function submitEnrichmentAnswers(resumeId, answers) {
  return api('/enrichment/answers', {
    method: 'POST',
    body: JSON.stringify({ resume_id: resumeId, answers }),
  })
}

/* ── Health & Config ── */

export async function checkHealth() {
  return api('/health')
}

export async function getConfig() {
  return api('/config/llm-api-key')
}

export async function updateConfig({ provider, model, apiKey }) {
  return api('/config/llm-api-key', {
    method: 'PUT',
    body: JSON.stringify({
      provider,
      model,
      api_key: apiKey,
    }),
  })
}
