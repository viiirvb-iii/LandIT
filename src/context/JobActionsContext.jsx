import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { supabase, supabaseConfigured } from '../lib/supabase'

const JobActionsContext = createContext(null)

const COLORS = ['#96bf48', '#4285f4', '#635bff', '#0052cc', '#a78bfa', '#8b5cf6', '#e91e63', '#14b8a6']
const GRADIENT_PALETTES = [
  ['#041408', '#1a5828', '#96bf48'],
  ['#040e28', '#1a3060', '#4285f4'],
  ['#09080f', '#1e1660', '#635bff'],
  ['#040c1c', '#0a2260', '#0052cc'],
  ['#1a0e28', '#5c1e5a', '#a78bfa'],
  ['#0f0a1e', '#3a1a5e', '#8b5cf6'],
  ['#1c0a0a', '#8b2252', '#e91e63'],
  ['#0a1a1a', '#1a5050', '#14b8a6'],
]

function hashStr(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const isUuid = (id) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/* Transform a DB application record (with joined job+company) into a UI job object */
function transformDbRecord(record) {
  const job = record.jobs || {}
  const company = job.companies || {}
  const fields =
    typeof job.job_description_fields === 'string'
      ? JSON.parse(job.job_description_fields)
      : job.job_description_fields || {}
  const skills =
    typeof job.skills_required === 'string'
      ? JSON.parse(job.skills_required)
      : job.skills_required || []

  const companyName = company.name || fields.company_name || 'Company'
  const pi = hashStr(job.id || record.id) % GRADIENT_PALETTES.length
  const skillNames = skills.map((s) => (typeof s === 'object' ? s.name : s))
  const location = fields.location || (company.locations && company.locations[0]) || 'Remote'

  return {
    id: job.id || record.job_id,
    dbRecordId: record.id,
    role: job.title || 'Unknown Role',
    company: companyName,
    location,
    salary: fields.salary || '',
    type: fields.job_type || job.job_type || 'Full-time',
    source: 'LinkedIn',
    posted: job.posted_at || 'Recently',
    match: record.fit_score || 75,
    logo: companyName.charAt(0).toUpperCase(),
    logoUrl: company.logo_url || fields.company_logo || null,
    color: COLORS[pi],
    g: GRADIENT_PALETTES[pi],
    tags: [location, fields.job_type || 'Full-time', ...skillNames.slice(0, 3)].filter(Boolean),
    desc: fields.summary || (job.raw_description || '').slice(0, 200),
    about: job.raw_description || fields.summary || '',
    skills: skillNames.map((n) => ({ name: n, state: 'ok' })),
    status: record.status || 'inflight',
    appliedDate: record.created_at
      ? new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'Today',
  }
}

export function JobActionsProvider({ children }) {
  const { user } = useAuth()
  const [boardedJobs, setBoardedJobs] = useState([])
  const [savedJobs, setSavedJobs] = useState([])
  const [passedJobs, setPassedJobs] = useState([])
  const [loaded, setLoaded] = useState(false)
  const loadedOnce = useRef(false)

  /* ── Load from Supabase on auth ── */
  useEffect(() => {
    if (!supabaseConfigured || !supabase || !user) {
      setLoaded(true)
      return
    }
    if (loadedOnce.current) return
    loadedOnce.current = true

    supabase
      .from('applications')
      .select(
        `id, status, job_id, created_at,
         jobs:job_id (
           id, title, field, job_type, job_description_fields, skills_required, raw_description, posted_at,
           companies:company_id ( id, name, logo_url, locations )
         )`
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn('Could not load applications:', error.message)
          setLoaded(true)
          return
        }
        const boarded = []
        const saved = []
        ;(data || []).forEach((record) => {
          if (!record.jobs) return
          const transformed = transformDbRecord(record)
          if (record.status === 'saved') saved.push(transformed)
          else boarded.push(transformed)
        })
        setBoardedJobs(boarded)
        setSavedJobs(saved)
        setLoaded(true)
      })
  }, [user])

  /* ── Helper: persist to applications table (fire-and-forget) ── */
  const dbInsert = useCallback(
    (jobId, status) => {
      if (!supabaseConfigured || !supabase || !user || !isUuid(jobId)) return
      supabase
        .from('applications')
        .insert({ user_id: user.id, job_id: jobId, status })
        .then(({ error }) => {
          if (error) console.warn('DB insert failed:', error.message)
        })
    },
    [user]
  )

  const dbDelete = useCallback(
    (jobId, dbRecordId) => {
      if (!supabaseConfigured || !supabase || !user) return
      const q = dbRecordId
        ? supabase.from('applications').delete().eq('id', dbRecordId).eq('user_id', user.id)
        : isUuid(jobId)
          ? supabase.from('applications').delete().eq('job_id', jobId).eq('user_id', user.id)
          : null
      if (q) q.then(({ error }) => { if (error) console.warn('DB delete failed:', error.message) })
    },
    [user]
  )

  const dbUpdateStatus = useCallback(
    (jobId, dbRecordId, newStatus) => {
      if (!supabaseConfigured || !supabase || !user) return
      const q = dbRecordId
        ? supabase.from('applications').update({ status: newStatus }).eq('id', dbRecordId).eq('user_id', user.id)
        : isUuid(jobId)
          ? supabase.from('applications').update({ status: newStatus }).eq('job_id', jobId).eq('user_id', user.id)
          : null
      if (q) q.then(({ error }) => { if (error) console.warn('DB status update failed:', error.message) })
    },
    [user]
  )

  /* ── Actions ── */

  const boardJob = useCallback(
    (job) => {
      setBoardedJobs((prev) => {
        if (prev.some((j) => j.id === job.id)) return prev
        return [
          ...prev,
          {
            ...job,
            appliedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            status: 'inflight',
          },
        ]
      })
      dbInsert(job.id, 'inflight')
    },
    [dbInsert]
  )

  const saveJob = useCallback(
    (job) => {
      setSavedJobs((prev) => {
        if (prev.some((j) => j.id === job.id)) return prev
        return [
          ...prev,
          {
            ...job,
            savedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          },
        ]
      })
      dbInsert(job.id, 'saved')
    },
    [dbInsert]
  )

  const passJob = useCallback((job) => {
    setPassedJobs((prev) => {
      if (prev.some((j) => j.id === job.id)) return prev
      return [...prev, job]
    })
  }, [])

  const removeBoarded = useCallback(
    (jobId) => {
      const job = boardedJobs.find((j) => j.id === jobId)
      setBoardedJobs((prev) => prev.filter((j) => j.id !== jobId))
      dbDelete(jobId, job?.dbRecordId)
    },
    [boardedJobs, dbDelete]
  )

  const removeSaved = useCallback(
    (jobId) => {
      const job = savedJobs.find((j) => j.id === jobId)
      setSavedJobs((prev) => prev.filter((j) => j.id !== jobId))
      dbDelete(jobId, job?.dbRecordId)
    },
    [savedJobs, dbDelete]
  )

  const updateBoardedStatus = useCallback(
    (jobId, newStatus) => {
      setBoardedJobs((prev) =>
        prev.map((j) => {
          if (j.id !== jobId) return j
          dbUpdateStatus(jobId, j.dbRecordId, newStatus)
          return { ...j, status: newStatus }
        })
      )
    },
    [dbUpdateStatus]
  )

  return (
    <JobActionsContext.Provider
      value={{
        boardedJobs,
        savedJobs,
        passedJobs,
        boardJob,
        saveJob,
        passJob,
        removeBoarded,
        removeSaved,
        updateBoardedStatus,
        loaded,
      }}
    >
      {children}
    </JobActionsContext.Provider>
  )
}

export function useJobActions() {
  const ctx = useContext(JobActionsContext)
  if (!ctx) throw new Error('useJobActions must be inside JobActionsProvider')
  return ctx
}
