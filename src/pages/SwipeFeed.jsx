import { useState, useRef, useCallback, useEffect } from 'react'
import { JOBS } from '../data/jobs'
import { supabase, supabaseConfigured } from '../lib/supabase'
import JobDetail from '../components/JobDetail'
import AutoTailor from '../components/AutoTailor'
import AICoach from '../components/AICoach'

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
const COLORS = ['#96bf48', '#4285f4', '#635bff', '#0052cc', '#a78bfa', '#8b5cf6', '#e91e63', '#14b8a6']

function transformSupabaseJob(row, index, companiesMap) {
  const fields = typeof row.job_description_fields === 'string'
    ? JSON.parse(row.job_description_fields)
    : row.job_description_fields || {}

  const skills = typeof row.skills_required === 'string'
    ? JSON.parse(row.skills_required)
    : row.skills_required || []

  const linkedCompany = companiesMap[row.company_id] || {}
  const company = fields.company_name || linkedCompany.name || row.title.split('@').pop()?.trim() || 'Company'
  const location = fields.location || (linkedCompany.locations && linkedCompany.locations[0]) || 'N/A'
  const pi = index % GRADIENT_PALETTES.length
  const skillNames = skills.map(s => typeof s === 'object' ? s.name : s)

  return {
    id: row.id || fields.linkedin_id || `supa-${index}`,
    role: row.title,
    company,
    location,
    salary: '',
    type: fields.job_type || 'full-time',
    source: 'LinkedIn',
    posted: row.posted_at || 'Scraped',
    match: Math.floor(Math.random() * 30) + 65,
    logo: company.charAt(0).toUpperCase(),
    logoUrl: fields.company_logo || linkedCompany.logo_url || null,
    color: COLORS[pi],
    g: GRADIENT_PALETTES[pi],
    tags: [location, fields.job_type || 'full-time', ...skillNames.slice(0, 3)].filter(Boolean),
    desc: fields.summary || (row.raw_description || '').slice(0, 160) + '...',
    about: row.raw_description || fields.summary || '',
    bullets: [],
    skills: skillNames.map(n => ({ name: n, state: 'ok' })),
    reqs: [],
    docs: [],
    timeline: [],
    companyAbout: '',
    deadline: '',
    duration: '',
  }
}

export default function SwipeFeed({ showToast }) {
  const [cardIdx, setCardIdx] = useState(0)
  const [swipeDir, setSwipeDir] = useState(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showTailor, setShowTailor] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const [allJobs, setAllJobs] = useState(JOBS)
  const dragStart = useRef(null)

  const toast = showToast || (() => {})

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return
    Promise.all([
      supabase.from('jobs').select('*').eq('is_active', true).order('posted_at', { ascending: false }),
      supabase.from('companies').select('id,name,logo_url,locations'),
    ]).then(([jobsRes, companiesRes]) => {
      const companiesMap = {}
      if (companiesRes.data) {
        companiesRes.data.forEach(c => { companiesMap[c.id] = c })
      }
      if (jobsRes.data && jobsRes.data.length > 0) {
        console.log(`Loaded ${jobsRes.data.length} jobs from Supabase`)
        const scraped = jobsRes.data.map((row, i) => transformSupabaseJob(row, i, companiesMap))
        setAllJobs([...scraped, ...JOBS])
      }
    }).catch(err => console.error('Supabase fetch failed:', err))
  }, [])

  const job = allJobs[cardIdx % allJobs.length]

  const doSwipe = useCallback((dir) => {
    if (swipeDir || !job) return
    setSwipeDir(dir)
    if (dir === 'right') toast('Added to boarding passes')
    else if (dir === 'left') toast('Passed')
    else toast('Saved to wishlist')
    setTimeout(() => {
      setSwipeDir(null)
      setDragX(0)
      setCardIdx(i => i + 1)
    }, 430)
  }, [swipeDir, toast])

  const onPointerDown = (e) => { dragStart.current = { x: e.clientX }; setDragging(true) }
  const onPointerMove = (e) => { if (!dragStart.current || !dragging) return; setDragX(e.clientX - dragStart.current.x) }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (Math.abs(dragX) > 100) doSwipe(dragX > 0 ? 'right' : 'left')
    else setDragX(0)
    dragStart.current = null
  }

  const rot = dragging ? dragX * 0.08 : 0
  const opa = dragging ? Math.max(0.5, 1 - Math.abs(dragX) / 400) : 1

  const swipeCls = swipeDir === 'right' ? 'animate-swipe-r' : swipeDir === 'left' ? 'animate-swipe-l' : swipeDir === 'up' ? 'animate-swipe-u' : ''

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative min-h-0 items-center justify-center">
      {/* Card area */}
      <div className="w-full px-3 pt-2 pb-1 relative overflow-hidden lg:px-8 lg:pt-4 flex-1 flex items-center justify-center">
        <div className="relative w-full h-full min-h-[480px] max-h-[620px] max-w-[420px] lg:max-w-[460px]">
          {/* Stack bg cards */}
          <div className="absolute inset-0 rounded-2xl bg-white border border-slate-200 shadow-sm scale-[0.88] translate-y-5 opacity-25" />
          <div className="absolute inset-0 rounded-2xl bg-white border border-slate-200 shadow-sm scale-[0.94] translate-y-2.5 opacity-50 z-[1]" />

          {/* Main card */}
          <div
            className={`absolute inset-0 z-[2] rounded-2xl overflow-hidden border border-slate-200 flex flex-col bg-white shadow-lg cursor-grab active:cursor-grabbing select-none touch-pan-y transition-[transform,opacity] duration-300 ${swipeCls}`}
            style={{
              transform: !swipeDir ? `translateX(${dragX}px) rotate(${rot}deg)` : undefined,
              opacity: !swipeDir ? opa : undefined,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* Swipe stamps */}
            {dragX > 50 && (
              <div className="absolute top-5 right-4 z-10 font-extrabold text-xl px-3.5 py-1 rounded-lg border-3 border-green-500 text-green-500 bg-green-500/10 rotate-8 tracking-widest">BOARD</div>
            )}
            {dragX < -50 && (
              <div className="absolute top-5 left-4 z-10 font-extrabold text-xl px-3.5 py-1 rounded-lg border-3 border-red-500 text-red-500 bg-red-500/10 -rotate-8 tracking-widest">SKIP</div>
            )}

            {/* Hero */}
            <div
              className="h-[155px] lg:h-[175px] shrink-0 relative overflow-hidden flex items-end"
              style={{ background: `linear-gradient(160deg, ${job.g[0]}15, ${job.g[1]}25, ${job.g[2]}18)` }}
            >
              <div className="p-3.5 w-full lg:p-5">
                <p className="text-[9px] lg:text-[11px] font-semibold tracking-wider uppercase text-slate-500 mb-1">
                  {job.match}% match &middot; {job.location}
                </p>
                <h2 className="text-[19px] lg:text-[22px] font-bold text-slate-900 leading-tight tracking-tight">{job.role}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  {job.logoUrl ? (
                    <img className="w-6 h-6 rounded-[7px] object-cover shrink-0" src={job.logoUrl} alt={job.company}
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                  ) : null}
                  <div className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: job.color, display: job.logoUrl ? 'none' : 'flex' }}>{job.logo}</div>
                  <span className="text-[11px] lg:text-xs text-slate-500">{job.company} &middot; {job.location}</span>
                  {job.salary && (
                    <span className="ml-auto bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5 text-[10px] lg:text-xs text-slate-900 font-medium">{job.salary}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-3.5 py-3 flex flex-col gap-2.5 overflow-hidden lg:px-5 lg:py-4 lg:gap-3">
              {/* Tags */}
              <div className="flex gap-1.5 flex-wrap">
                {job.tags.slice(0, 4).map(t => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] lg:text-xs text-slate-500">{t}</span>
                ))}
              </div>

              {/* Match bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] lg:text-xs text-slate-400">Flight match</span>
                <div className="flex-1 h-[3px] bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-[width] duration-500" style={{ width: `${job.match}%` }} />
                </div>
                <span className="text-[11px] lg:text-sm text-blue-500 font-semibold min-w-[28px] text-right">{job.match}%</span>
              </div>

              {/* Description */}
              <p className="text-[11px] lg:text-sm text-slate-500 leading-relaxed font-light">{job.desc}</p>
            </div>

            {/* Actions */}
            <div className="shrink-0 px-3 py-2 flex gap-1.5 bg-slate-50/80 border-t border-slate-100 lg:px-4 lg:py-3 lg:gap-2">
              {[
                { label: 'Company', icon: 'i', onClick: () => setShowDetail(true) },
                { label: 'AI Coach', icon: '\u2726', onClick: () => setShowCoach(true), primary: true },
                { label: 'Auto-tailor', icon: '\u26A1', onClick: () => setShowTailor(true) },
                { label: 'Save', icon: '\u2605', onClick: () => doSwipe('up'), star: true },
              ].map(btn => (
                <button
                  key={btn.label}
                  className={`flex-1 py-2 lg:py-2.5 rounded-xl border text-[9px] lg:text-[11px] font-medium flex flex-col items-center gap-0.5 transition-colors cursor-pointer
                    ${btn.primary ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' :
                      btn.star ? 'bg-amber-50 border-amber-200 text-amber-500' :
                      'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  onClick={(e) => { e.stopPropagation(); btn.onClick() }}
                >
                  <span className="text-sm lg:text-base leading-none">{btn.icon}</span>
                  <span className="text-[8px] lg:text-[10px] leading-tight text-center">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Swipe buttons */}
      <div className="flex justify-center items-center gap-3.5 py-2 shrink-0 lg:py-3 lg:gap-5">
        <button onClick={() => doSwipe('left')}
          className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-red-50 border-[1.5px] border-red-200 flex items-center justify-center hover:scale-110 active:scale-95 active:opacity-80 transition cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button onClick={() => doSwipe('right')}
          className="w-[58px] h-[58px] lg:w-[68px] lg:h-[68px] rounded-full bg-blue-500 flex items-center justify-center shadow-[0_6px_20px_rgba(59,130,246,0.35)] hover:scale-110 active:scale-95 active:opacity-80 transition cursor-pointer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#fff"/>
          </svg>
        </button>
        <button onClick={() => doSwipe('up')}
          className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-amber-50 border-[1.5px] border-amber-200 flex items-center justify-center hover:scale-110 active:scale-95 active:opacity-80 transition cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="12 2 12 22"/><polyline points="6 8 12 2 18 8"/>
          </svg>
        </button>
      </div>

      {/* Overlays */}
      <JobDetail job={job} open={showDetail} onClose={() => setShowDetail(false)}
        onApply={() => { toast('Added to boarding passes'); setShowDetail(false) }}
        onSave={() => { toast('Saved to wishlist'); setShowDetail(false) }}
        onOpenTailor={() => { setShowDetail(false); setShowTailor(true) }}
        onOpenCoach={() => { setShowDetail(false); setShowCoach(true) }}
      />
      <AutoTailor job={job} open={showTailor} onClose={() => setShowTailor(false)} onToast={toast} />
      <AICoach job={job} open={showCoach} onClose={() => setShowCoach(false)} onToast={toast} />

      <style>{`
        @keyframes swipe-r { to { transform: translateX(360px) rotate(16deg); opacity: 0; } }
        @keyframes swipe-l { to { transform: translateX(-360px) rotate(-16deg); opacity: 0; } }
        @keyframes swipe-u { to { transform: translateY(-320px) scale(0.8); opacity: 0; } }
        .animate-swipe-r { animation: swipe-r 0.43s cubic-bezier(0.55,0,1,0.45) forwards; }
        .animate-swipe-l { animation: swipe-l 0.43s cubic-bezier(0.55,0,1,0.45) forwards; }
        .animate-swipe-u { animation: swipe-u 0.43s cubic-bezier(0.55,0,1,0.45) forwards; }
      `}</style>
    </div>
  )
}
