// LandIt — Supabase connectivity test
// Run with: node --env-file=.env test.js
//
// Uses process.env directly (not import.meta.env) so it works outside Vite.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('\n❌  Missing env vars — check your .env file contains:')
  console.error('    VITE_SUPABASE_URL=...')
  console.error('    VITE_SUPABASE_ANON_KEY=...\n')
  process.exit(1)
}

const supabase = createClient(url, key)

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(label, detail) {
  console.log(`  ✅  ${label}${detail ? ` — ${detail}` : ''}`)
}

function fail(label, err) {
  console.error(`  ❌  ${label} — ${err.message ?? err}`)
}

async function check(label, fn) {
  try {
    const result = await fn()
    pass(label, result)
    return true
  } catch (err) {
    fail(label, err)
    return false
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

async function testConnection() {
  // Lightest possible query — just prove the project URL + key work
  const { error } = await supabase.from('companies').select('id').limit(1)
  if (error) throw error
  return 'reachable'
}

async function countTable(table, filters = []) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  for (const [col, val] of filters) q = q.eq(col, val)
  const { count, error } = await q
  if (error) throw error
  return `${count} rows`
}

async function testSwipeFeed() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, companies(name)')
    .eq('is_active', true)
    .order('posted_at', { ascending: false })
    .limit(3)
  if (error) throw error
  if (!data.length) return 'no active jobs found'
  return data.map(j => `"${j.title}" @ ${j.companies?.name ?? '?'}`).join(' | ')
}

async function testRelations() {
  // Verify FK join: jobs → companies
  const { data, error } = await supabase
    .from('jobs')
    .select('id, companies(id, name)')
    .limit(1)
    .single()
  if (error) throw error
  if (!data.companies) throw new Error('jobs.company_id FK join returned null')
  return `jobs → companies join OK`
}

// ── run ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════')
  console.log('  LandIt — Supabase Connectivity Test')
  console.log('══════════════════════════════════════════')
  console.log(`  URL  ${url}`)
  console.log()

  let passed = 0
  let total  = 0

  async function run_check(label, fn) {
    total++
    if (await check(label, fn)) passed++
  }

  // 1. Basic connectivity
  console.log('── Connection ──')
  await run_check('Supabase reachable', testConnection)

  // 2. Table access (row counts)
  console.log('\n── Tables ──')
  await run_check('companies',  () => countTable('companies'))
  await run_check('jobs',       () => countTable('jobs'))
  await run_check('jobs (active only)', () => countTable('jobs', [['is_active', true]]))
  await run_check('users',      () => countTable('users'))
  await run_check('user_jobs',  () => countTable('user_jobs'))

  // 3. Query shapes used by the service layer
  console.log('\n── Service query shapes ──')
  await run_check('getSwipeFeed() shape',  testSwipeFeed)
  await run_check('FK join (jobs → companies)', testRelations)

  // ── Summary ──
  console.log(`\n══════════════════════════════════════════`)
  console.log(`  ${passed}/${total} checks passed`)
  if (passed < total) {
    console.log(`  Some checks failed — see ❌ lines above.`)
    console.log(`  If you see "permission denied", RLS is blocking anon reads.`)
    console.log(`  Test again with an authenticated session or temporarily allow anon SELECT.`)
  } else {
    console.log(`  All checks passed — Supabase is connected and schema looks correct.`)
  }
  console.log('══════════════════════════════════════════\n')

  process.exit(passed < total ? 1 : 0)
}

run()
