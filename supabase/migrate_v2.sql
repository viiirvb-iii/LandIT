-- ============================================
-- Landed App – V2 MIGRATION (Resume-Matcher features)
-- Adds: cover_letters, enrichment_sessions tables
-- Adds: new columns on tailored_resumes
-- Paste this into Supabase SQL Editor and Run
-- ============================================

-- ============================================
-- COVER LETTERS TABLE
-- ============================================
create table if not exists public.cover_letters (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  content_type text not null check (content_type in ('cover_letter', 'outreach', 'title')),
  content text not null default '',
  language text default 'en',
  version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cover_letters enable row level security;

do $$ begin drop policy if exists "Users can manage own cover letters" on public.cover_letters; end $$;
create policy "Users can manage own cover letters" on public.cover_letters
  for all using (auth.uid() = user_id);

create index if not exists idx_cover_letters_user on public.cover_letters(user_id);
create index if not exists idx_cover_letters_job on public.cover_letters(job_id);

-- ============================================
-- ENRICHMENT SESSIONS TABLE
-- ============================================
create table if not exists public.enrichment_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'analyzing' check (status in ('analyzing', 'questions_ready', 'answering', 'enhancing', 'complete')),
  weak_items jsonb default '[]',
  questions jsonb default '[]',
  answers jsonb default '[]',
  enhancements jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.enrichment_sessions enable row level security;

do $$ begin drop policy if exists "Users can manage own enrichment sessions" on public.enrichment_sessions; end $$;
create policy "Users can manage own enrichment sessions" on public.enrichment_sessions
  for all using (auth.uid() = user_id);

create index if not exists idx_enrichment_sessions_user on public.enrichment_sessions(user_id);

-- ============================================
-- NEW COLUMNS ON TAILORED_RESUMES
-- ============================================
alter table public.tailored_resumes add column if not exists mode text default 'keywords';
alter table public.tailored_resumes add column if not exists diff_summary jsonb default '{}';
alter table public.tailored_resumes add column if not exists diff_changes jsonb default '[]';
alter table public.tailored_resumes add column if not exists refinement_stats jsonb default '{}';
alter table public.tailored_resumes add column if not exists safety_warnings text[] default '{}';

-- ============================================
-- NEW COLUMNS ON APPLICATIONS (cover letter / outreach text)
-- ============================================
alter table public.applications add column if not exists cover_letter_text text default '';
alter table public.applications add column if not exists outreach_text text default '';
