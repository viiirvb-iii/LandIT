-- ============================================
-- Landed App – SAFE MIGRATION
-- Skips existing tables/types/indexes/policies
-- Paste this into Supabase SQL Editor and Run
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================
-- PROFILES
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  country text default 'AUSTRALIA',
  city_from text default 'MELB',
  city_to text default 'HIRE',
  degree text default '',
  university text default '',
  year text default '',
  searching_for text default 'Internships 2026',
  preferred_locations text[] default '{}',
  preferred_fields text[] default '{}',
  resume_url text,
  resume_updated_at timestamptz,
  ai_tailors_remaining int default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- JOBS (may already exist from scraper)
-- ============================================
create table if not exists public.jobs (
  id uuid default uuid_generate_v4() primary key,
  external_id text unique,
  role text not null,
  company text not null,
  location text default '',
  salary text default '',
  job_type text default 'Intern',
  source text default '',
  posted_at timestamptz default now(),
  deadline date,
  duration text default '',
  match_score int default 0,
  logo_letter text default '',
  logo_color text default '#3b82f6',
  gradient_colors text[] default '{}',
  tags text[] default '{}',
  description text default '',
  about text default '',
  bullets text[] default '{}',
  company_about text default '',
  requirements jsonb default '[]',
  skill_matches jsonb default '[]',
  documents jsonb default '[]',
  timeline jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add columns to jobs if they don't exist yet (from scraper schema)
do $$ begin
  alter table public.jobs add column if not exists external_id text;
  alter table public.jobs add column if not exists match_score int default 0;
  alter table public.jobs add column if not exists logo_letter text default '';
  alter table public.jobs add column if not exists logo_color text default '#3b82f6';
  alter table public.jobs add column if not exists gradient_colors text[] default '{}';
  alter table public.jobs add column if not exists tags text[] default '{}';
  alter table public.jobs add column if not exists about text default '';
  alter table public.jobs add column if not exists bullets text[] default '{}';
  alter table public.jobs add column if not exists company_about text default '';
  alter table public.jobs add column if not exists requirements jsonb default '[]';
  alter table public.jobs add column if not exists skill_matches jsonb default '[]';
  alter table public.jobs add column if not exists documents jsonb default '[]';
  alter table public.jobs add column if not exists timeline jsonb default '[]';
  alter table public.jobs add column if not exists deadline date;
  alter table public.jobs add column if not exists duration text default '';
exception when others then null;
end $$;

-- ============================================
-- ENUM TYPES (create only if missing)
-- ============================================
do $$ begin create type application_status as enum ('saved', 'applied', 'inflight', 'landed', 'departed'); exception when duplicate_object then null; end $$;
do $$ begin create type swipe_direction as enum ('left', 'right', 'up'); exception when duplicate_object then null; end $$;
do $$ begin create type skill_level as enum ('strong', 'ok', 'gap'); exception when duplicate_object then null; end $$;

-- ============================================
-- APPLICATIONS (Boarding passes)
-- ============================================
create table if not exists public.applications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  status application_status default 'saved',
  applied_at timestamptz default now(),
  has_unread boolean default false,
  tailored_resume_url text,
  cover_letter_url text,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, job_id)
);

-- ============================================
-- SAVED JOBS (Wishlist)
-- ============================================
create table if not exists public.saved_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  saved_at timestamptz default now(),
  unique(user_id, job_id)
);

-- ============================================
-- SWIPE HISTORY
-- ============================================
create table if not exists public.swipe_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  direction swipe_direction not null,
  swiped_at timestamptz default now()
);

-- ============================================
-- USER SKILLS
-- ============================================
create table if not exists public.user_skills (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  skill_name text not null,
  level int default 0 check (level >= 0 and level <= 100),
  tag skill_level default 'gap',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, skill_name)
);

-- ============================================
-- SKILL GAPS
-- ============================================
create table if not exists public.skill_gaps (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  skill_name text not null,
  frequency int default 1,
  updated_at timestamptz default now(),
  unique(user_id, skill_name)
);

-- ============================================
-- WATCHLIST COMPANIES
-- ============================================
create table if not exists public.watchlist_companies (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  company_name text not null,
  sector text default '',
  logo_letter text default '',
  logo_color text default '',
  gradient text default '',
  description text default '',
  roles text[] default '{}',
  added_at timestamptz default now(),
  unique(user_id, company_name)
);

-- ============================================
-- COACHING SESSIONS
-- ============================================
create table if not exists public.coaching_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade,
  mode text check (mode in ('existing', 'build')),
  initial_score int default 54,
  final_score int,
  changes_approved int default 0,
  changes_total int default 0,
  answers jsonb default '{}',
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- TAILORED RESUMES
-- ============================================
create table if not exists public.tailored_resumes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade,
  original_content text default '',
  tailored_content text default '',
  ats_score_before int default 54,
  ats_score_after int,
  changes jsonb default '[]',
  file_url text,
  created_at timestamptz default now()
);

-- ============================================
-- STAMPS
-- ============================================
create table if not exists public.stamps (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stamp_type text not null,
  label text default '',
  icon text default '✦',
  earned_at timestamptz default now()
);

-- ============================================
-- PARSED RESUMES
-- ============================================
create table if not exists public.parsed_resumes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  storage_path text not null,
  parsed_data jsonb not null default '{}',
  skills_extracted text[] default '{}',
  raw_text text default '',
  parsed_at timestamptz default now()
);

-- ============================================
-- RESUME CHUNKS (for RAG / pgvector)
-- ============================================
create table if not exists public.resume_chunks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  chunk_text text not null,
  chunk_index int not null,
  section_label text default '',
  embedding vector(1536)
);

-- ============================================
-- INDEXES (IF NOT EXISTS)
-- ============================================
create index if not exists idx_resume_chunks_user on public.resume_chunks(user_id);
create index if not exists idx_applications_user on public.applications(user_id);
create index if not exists idx_applications_job on public.applications(job_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_saved_jobs_user on public.saved_jobs(user_id);
create index if not exists idx_swipe_history_user on public.swipe_history(user_id);
create index if not exists idx_user_skills_user on public.user_skills(user_id);
create index if not exists idx_jobs_active on public.jobs(is_active);
create index if not exists idx_coaching_sessions_user on public.coaching_sessions(user_id);

-- ivfflat index needs special handling (no IF NOT EXISTS support)
do $$ begin
  create index idx_resume_chunks_embedding on public.resume_chunks
    using ivfflat (embedding vector_cosine_ops) with (lists = 10);
exception when duplicate_table then null;
end $$;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Helper: enable RLS + create policy only if it doesn't exist
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.swipe_history enable row level security;
alter table public.user_skills enable row level security;
alter table public.skill_gaps enable row level security;
alter table public.watchlist_companies enable row level security;
alter table public.coaching_sessions enable row level security;
alter table public.tailored_resumes enable row level security;
alter table public.stamps enable row level security;
alter table public.parsed_resumes enable row level security;
alter table public.resume_chunks enable row level security;

-- Drop and recreate policies (safe — no data loss)
do $$ begin drop policy if exists "Users can view own profile" on public.profiles; end $$;
do $$ begin drop policy if exists "Users can update own profile" on public.profiles; end $$;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

do $$ begin drop policy if exists "Jobs are viewable by authenticated users" on public.jobs; end $$;
create policy "Jobs are viewable by authenticated users" on public.jobs for select using (auth.role() = 'authenticated');

do $$ begin drop policy if exists "Users can view own applications" on public.applications; end $$;
do $$ begin drop policy if exists "Users can insert own applications" on public.applications; end $$;
do $$ begin drop policy if exists "Users can update own applications" on public.applications; end $$;
do $$ begin drop policy if exists "Users can delete own applications" on public.applications; end $$;
create policy "Users can view own applications" on public.applications for select using (auth.uid() = user_id);
create policy "Users can insert own applications" on public.applications for insert with check (auth.uid() = user_id);
create policy "Users can update own applications" on public.applications for update using (auth.uid() = user_id);
create policy "Users can delete own applications" on public.applications for delete using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own saved jobs" on public.saved_jobs; end $$;
create policy "Users can manage own saved jobs" on public.saved_jobs for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own swipe history" on public.swipe_history; end $$;
create policy "Users can manage own swipe history" on public.swipe_history for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own skills" on public.user_skills; end $$;
create policy "Users can manage own skills" on public.user_skills for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own skill gaps" on public.skill_gaps; end $$;
create policy "Users can manage own skill gaps" on public.skill_gaps for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own watchlist" on public.watchlist_companies; end $$;
create policy "Users can manage own watchlist" on public.watchlist_companies for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own coaching sessions" on public.coaching_sessions; end $$;
create policy "Users can manage own coaching sessions" on public.coaching_sessions for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own tailored resumes" on public.tailored_resumes; end $$;
create policy "Users can manage own tailored resumes" on public.tailored_resumes for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own stamps" on public.stamps; end $$;
create policy "Users can manage own stamps" on public.stamps for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own parsed resumes" on public.parsed_resumes; end $$;
create policy "Users can manage own parsed resumes" on public.parsed_resumes for all using (auth.uid() = user_id);

do $$ begin drop policy if exists "Users can manage own resume chunks" on public.resume_chunks; end $$;
create policy "Users can manage own resume chunks" on public.resume_chunks for all using (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
drop trigger if exists jobs_updated_at on public.jobs;
drop trigger if exists applications_updated_at on public.applications;
drop trigger if exists user_skills_updated_at on public.user_skills;
drop trigger if exists skill_gaps_updated_at on public.skill_gaps;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute procedure public.update_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute procedure public.update_updated_at();
create trigger user_skills_updated_at before update on public.user_skills
  for each row execute procedure public.update_updated_at();
create trigger skill_gaps_updated_at before update on public.skill_gaps
  for each row execute procedure public.update_updated_at();

-- ============================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================
create or replace function public.match_resume_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  chunk_text text,
  section_label text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    rc.id,
    rc.chunk_text,
    rc.section_label,
    1 - (rc.embedding <=> query_embedding) as similarity
  from public.resume_chunks rc
  where rc.user_id = match_user_id
  order by rc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage buckets for resumes and avatars
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Storage policies for resumes bucket (private — users can only access their own)
do $$ begin drop policy if exists "Users can upload own resume" on storage.objects; end $$;
create policy "Users can upload own resume" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

do $$ begin drop policy if exists "Users can read own resume" on storage.objects; end $$;
create policy "Users can read own resume" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

do $$ begin drop policy if exists "Users can update own resume" on storage.objects; end $$;
create policy "Users can update own resume" on storage.objects
  for update using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for avatars bucket (public read, owner write)
do $$ begin drop policy if exists "Anyone can read avatars" on storage.objects; end $$;
create policy "Anyone can read avatars" on storage.objects
  for select using (bucket_id = 'avatars');

do $$ begin drop policy if exists "Users can upload own avatar" on storage.objects; end $$;
create policy "Users can upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

do $$ begin drop policy if exists "Users can update own avatar" on storage.objects; end $$;
create policy "Users can update own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- DONE!
-- ============================================
