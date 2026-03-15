import { createContext, useContext, useState, useCallback } from 'react'

const JobActionsContext = createContext(null)

export function JobActionsProvider({ children }) {
  const [boardedJobs, setBoardedJobs] = useState([])   // swiped right
  const [savedJobs, setSavedJobs] = useState([])        // swiped up (wishlist)
  const [passedJobs, setPassedJobs] = useState([])      // swiped left

  const boardJob = useCallback((job) => {
    setBoardedJobs(prev => {
      if (prev.some(j => j.id === job.id)) return prev
      return [...prev, { ...job, appliedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), status: 'inflight' }]
    })
  }, [])

  const saveJob = useCallback((job) => {
    setSavedJobs(prev => {
      if (prev.some(j => j.id === job.id)) return prev
      return [...prev, { ...job, savedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }]
    })
  }, [])

  const passJob = useCallback((job) => {
    setPassedJobs(prev => {
      if (prev.some(j => j.id === job.id)) return prev
      return [...prev, job]
    })
  }, [])

  const removeBoarded = useCallback((jobId) => {
    setBoardedJobs(prev => prev.filter(j => j.id !== jobId))
  }, [])

  const removeSaved = useCallback((jobId) => {
    setSavedJobs(prev => prev.filter(j => j.id !== jobId))
  }, [])

  const updateBoardedStatus = useCallback((jobId, newStatus) => {
    setBoardedJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
  }, [])

  return (
    <JobActionsContext.Provider value={{ boardedJobs, savedJobs, passedJobs, boardJob, saveJob, passJob, removeBoarded, removeSaved, updateBoardedStatus }}>
      {children}
    </JobActionsContext.Provider>
  )
}

export function useJobActions() {
  const ctx = useContext(JobActionsContext)
  if (!ctx) throw new Error('useJobActions must be inside JobActionsProvider')
  return ctx
}
