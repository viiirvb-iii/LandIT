import { supabase } from '../lib/supabase.js'

// Fetch the current user's profile
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Update session preferences (called at start of each session)
export async function updateSessionPreferences(userId, preferences) {
  const { data, error } = await supabase
    .from('users')
    .update({ session_preferences: preferences })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update skills list
export async function updateSkills(userId, skills) {
  // skills = [{ name: 'React', level: 'intermediate' }, ...]
  const { data, error } = await supabase
    .from('users')
    .update({ skills })
    .eq('id', userId)
    .select('skills')
    .single()

  if (error) throw error
  return data
}

// Add a passport stamp
export async function addPassportStamp(userId, stamp) {
  // stamp = { type: 'applied', label: 'Shopify Applied', awarded_at: '2026-03-14' }

  // Fetch current passport data first
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('passport_data')
    .eq('id', userId)
    .single()

  if (fetchError) throw fetchError

  const updatedPassport = {
    ...user.passport_data,
    stamps: [...(user.passport_data.stamps ?? []), stamp]
  }

  const { data, error } = await supabase
    .from('users')
    .update({ passport_data: updatedPassport })
    .eq('id', userId)
    .select('passport_data')
    .single()

  if (error) throw error
  return data
}

// Decrement daily auto-update quota
export async function decrementAutoUpdates(userId) {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('session_preferences')
    .eq('id', userId)
    .single()

  if (fetchError) throw fetchError

  const current = user.session_preferences.auto_updates_remaining ?? 0
  if (current <= 0) throw new Error('Daily auto-update limit reached')

  const { data, error } = await supabase
    .from('users')
    .update({
      session_preferences: {
        ...user.session_preferences,
        auto_updates_remaining: current - 1
      }
    })
    .eq('id', userId)
    .select('session_preferences')
    .single()

  if (error) throw error
  return data
}