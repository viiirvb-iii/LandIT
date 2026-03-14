import supabase from '../lib/supabase.js'

// Fetch all companies (for wishlist screen)
export async function getCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, logo_url, banner_url, description, locations, metadata')
    .order('name')

  if (error) throw error
  return data
}

// Fetch a single company with all its active jobs
export async function getCompanyById(companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      logo_url,
      banner_url,
      description,
      locations,
      metadata,
      jobs (
        id,
        title,
        field,
        job_type,
        job_description_fields,
        skills_required,
        posted_at
      )
    `)
    .eq('id', companyId)
    .eq('jobs.is_active', true)
    .single()

  if (error) throw error
  return data
}

// Fetch companies the user hasn't applied to yet (wishlist candidates)
export async function getWishlistCompanies(userId) {
  const { data, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      logo_url,
      banner_url,
      description,
      locations,
      jobs ( id )
    `)
    .not('jobs.id', 'in', `(
      select j.id from jobs j
      inner join user_jobs uj on uj.job_id = j.id
      where uj.user_id = '${userId}'
    )`)

  if (error) throw error
  return data
}