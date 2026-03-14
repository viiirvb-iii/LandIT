import { supabase } from '../lib/supabase.js'

// Review screen — all boarding passes for a user
export async function getUserApplications(userId) {
  const { data, error } = await supabase
    .from('user_jobs')
    .select(`
      id,
      status,
      fit_score,
      action_type,
      starred_at,
      applied_at,
      regime_generated_at,
      application_data,
      skill_analysis,
      jobs (
        id,
        title,
        field,
        job_type,
        job_description_fields,
        skills_required,
        companies (
          id,
          name,
          logo_url
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Save a job from the swipe screen (star / coach / auto)
export async function saveJob(userId, jobId, { actionType, fitScore }) {
  const { data, error } = await supabase
    .from('user_jobs')
    .insert({
      user_id:    userId,
      job_id:     jobId,
      status:     'departed',
      action_type: actionType,  // 'starred' | 'coach' | 'auto'
      fit_score:  fitScore,
      starred_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update status when regime work begins or completes
export async function updateApplicationStatus(userJobId, userId, { status, applicationData }) {
  const updates = { status }

  if (applicationData) updates.application_data = applicationData
  if (status === 'in_flight') updates.applied_at = new Date().toISOString()
  if (status === 'landed')    updates.regime_confirmed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_jobs')
    .update(updates)
    .eq('id', userJobId)
    .eq('user_id', userId)   // always scope to current user
    .select()
    .single()

  if (error) throw error
  return data
}

// Store generated regime documents
export async function saveRegimeDocuments(userJobId, userId, { coverLetterText, coverLetterUrl, tailoredResumeUrl, regimeNotes }) {
  const { data: existing, error: fetchError } = await supabase
    .from('user_jobs')
    .select('application_data')
    .eq('id', userJobId)
    .eq('user_id', userId)
    .single()

  if (fetchError) throw fetchError

  const { data, error } = await supabase
    .from('user_jobs')
    .update({
      status: 'in_flight',
      regime_generated_at: new Date().toISOString(),
      application_data: {
        ...existing.application_data,
        cover_letter_text:    coverLetterText    ?? existing.application_data.cover_letter_text,
        cover_letter_url:     coverLetterUrl     ?? existing.application_data.cover_letter_url,
        tailored_resume_url:  tailoredResumeUrl  ?? existing.application_data.tailored_resume_url,
        regime_notes:         regimeNotes        ?? existing.application_data.regime_notes,
        is_unread:            true
      }
    })
    .eq('id', userJobId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Mark a document as read (clears the unread dot)
export async function markAsRead(userJobId, userId) {
  const { data: existing, error: fetchError } = await supabase
    .from('user_jobs')
    .select('application_data')
    .eq('id', userJobId)
    .eq('user_id', userId)
    .single()

  if (fetchError) throw fetchError

  const { data, error } = await supabase
    .from('user_jobs')
    .update({
      application_data: { ...existing.application_data, is_unread: false }
    })
    .eq('id', userJobId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Skill gap aggregation for wishlist screen
export async function getSkillGaps(userId) {
  const { data, error } = await supabase
    .from('user_jobs')
    .select('skill_analysis')
    .eq('user_id', userId)

  if (error) throw error

  // Aggregate missing skills client-side from the JSON arrays
  const frequency = {}
  data.forEach(row => {
    (row.skill_analysis?.missing ?? []).forEach(skill => {
      frequency[skill] = (frequency[skill] ?? 0) + 1
    })
  })

  return Object.entries(frequency)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}