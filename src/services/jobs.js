import { supabase } from '../lib/supabase.js'

// Swipe feed — active jobs with company info, newest first
export async function getSwipeFeed({ limit = 20, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      title,
      field,
      industry,
      job_type,
      job_description_fields,
      skills_required,
      posted_at,
      companies (
        id,
        name,
        logo_url,
        banner_url,
        description,
        locations
      )
    `)
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data
}

// Filter jobs (explore screen)
export async function getFilteredJobs({ field, industry, jobType, location } = {}) {
  let query = supabase
    .from('jobs')
    .select(`
      id,
      title,
      field,
      job_type,
      job_description_fields,
      skills_required,
      companies ( id, name, logo_url )
    `)
    .eq('is_active', true)

  if (field)    query = query.eq('field', field)
  if (industry) query = query.eq('industry', industry)
  if (jobType)  query = query.eq('job_type', jobType)

  const { data, error } = await query.order('posted_at', { ascending: false })

  if (error) throw error
  return data
}

// Single job detail
export async function getJobById(jobId) {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      title,
      field,
      industry,
      job_type,
      raw_description,
      job_description_fields,
      skills_required,
      posted_at,
      companies (
        id,
        name,
        logo_url,
        banner_url,
        description,
        website_url,
        locations
      )
    `)
    .eq('id', jobId)
    .single()

  if (error) throw error
  return data
}