import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSwipeFeed } from '../services/jobs'
import JobDetail from '../components/JobDetail'
import AutoTailor from '../components/AutoTailor'
import AICoach from '../components/AICoach'
import './SwipeFeed.css'

const GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#ff9a9e', '#fecfef'],
  ['#ffecd2', '#fcb69f'],
]

function mapJob(j, idx) {
  const company = j.companies ?? {}
  const desc = j.job_description_fields ?? {}
  const location =
    desc.location ??
    (Array.isArray(company.locations) ? company.locations[0] : null) ??
    'Remote'
  const tags = (j.skills_required ?? []).slice(0, 6).map(s => s.name)
  const skills = (j.skills_required ?? []).map(s =>
    s.level ? `${s.name} (${s.level})` : s.name
  )
  return {
    id: j.id,
    role: j.title,
    company: company.name ?? 'Unknown',
    location,
    salary: desc.salary ?? 'Competitive',
    type: j.job_type ?? desc.job_type ?? 'Full-time',
    source: 'LandIt',
    posted: j.posted_at ? new Date(j.posted_at).toLocaleDateString() : 'Recently',
    match: 0,
    logo: (company.name ?? 'J')[0].toUpperCase(),
    g: GRADIENTS[idx % GRADIENTS.length],
    tags,
    desc: desc.summary ?? company.description ?? '',
    bullets: [],
    skills,
  }
}

export default function SwipeFeed({ showToast }) {
  const [jobs, setJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [liked, setLiked] = useState([])
  const [cardIdx, setCardIdx] = useState(0)
  const [swipeDir, setSwipeDir] = useState(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showTailor, setShowTailor] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const dragStart = useRef(null)

  const { signOut } = useAuth()
  const navigate = useNavigate()
  const toast = showToast || (() => {})

  useEffect(() => {
    getSwipeFeed({ limit: 50 })
      .then(data => setJobs(data.map(mapJob)))
      .catch(err => setFetchError(err.message ?? 'Failed to load jobs'))
      .finally(() => setLoadingJobs(false))
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const job   = jobs[cardIdx % Math.max(jobs.length, 1)]
  const next1 = jobs[(cardIdx + 1) % Math.max(jobs.length, 1)]
  const next2 = jobs[(cardIdx + 2) % Math.max(jobs.length, 1)]

  const doSwipe = useCallback((dir) => {
    if (swipeDir || !job) return
    setSwipeDir(dir)
    if (dir === 'right') {
      setLiked(p => [...p, job])
      toast('✈ Added to boarding passes')
    } else if (dir === 'left') {
      toast('Passed')
    } else {
      toast('★ Saved to wishlist')
    }
    setTimeout(() => {
      setSwipeDir(null)
      setDragX(0)
      setCardIdx(i => i + 1)
    }, 430)
  }, [swipeDir, job, toast])

  const onPointerDown = (e) => {
    dragStart.current = { x: e.clientX }
    setDragging(true)
  }
  const onPointerMove = (e) => {
    if (!dragStart.current || !dragging) return
    setDragX(e.clientX - dragStart.current.x)
  }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > 100) doSwipe(dragX > 0 ? 'right' : 'left')
    else setDragX(0)
    dragStart.curren