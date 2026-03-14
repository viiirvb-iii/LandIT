-- ============================================
-- Landed App - Supabase Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (Passport data)
-- ============================================
create table public.profiles (
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- JOBS (Job listings)
-- ============================================
create table public.jobs (
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

-- ============================================
-- APPLICATIONS (Boarding passes)
-- ============================================
create type application_status as enum ('saved', 'applied', 'inflight', 'landed', 'departed');

create table public.applications (
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
create table public.saved_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  saved_at timestamptz default now(),
  unique(user_id, job_id)
);

-- ============================================
-- SWIPE HISTORY (Track all swipes)
-- ============================================
create type swipe_direction as enum ('left', 'right', 'up');

create table public.swipe_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  direction swipe_direction not null,
  swiped_at timestamptz default now()
);

-- ============================================
-- USER SKILLS (Skill radar)
-- ============================================
create type skill_level as enum ('strong', 'ok', 'gap');

create table public.user_skills (
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
-- SKILL GAPS (Aggregated from job requirements)
-- ============================================
create table public.skill_gaps (
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
create table public.watchlist_companies (
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
create table public.coaching_sessions (
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
create table public.tailored_resumes (
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
-- APPLICATION STAMPS (Passport achievements)
-- ============================================
create table public.stamps (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  stamp_type text not null,
  label text default '',
  icon text default '✦',
  earned_at timestamptz default now()
);

-- ============================================
-- RAG: Enable pgvector extension
-- ============================================
create extension if not exists vector;

-- ============================================
-- PARSED RESUMES (Structured extraction from uploaded resumes)
-- ============================================
create table public.parsed_resumes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  storage_path text not null,
  parsed_data jsonb not null default '{}',
  skills_extracted text[] default '{}',
  raw_text text default '',
  parsed_at timestamptz default now()
);

-- ============================================
-- RESUME CHUNKS (Embedded text chunks for semantic retrieval)
-- ============================================
create table public.resume_chunks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  chunk_text text not null,
  chunk_index int not null,
  section_label text default '',
  embedding vector(1536)
);

create index idx_resume_chunks_embedding on public.resume_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 10);
create index idx_resume_chunks_user on public.resume_chunks(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles: users can only access their own
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Jobs: readable by all authenticated users
alter table public.jobs enable row level security;
create policy "Jobs are viewable by authenticated users" on public.jobs for select using (auth.role() = 'authenticated');

-- Applications: users can only access their own
alter table public.applications enable row level security;
create policy "Users can view own applications" on public.applications for select using (auth.uid() = user_id);
create policy "Users can insert own applications" on public.applications for insert with check (auth.uid() = user_id);
create policy "Users can update own applications" on public.applications for update using (auth.uid() = user_id);
create policy "Users can delete own applications" on public.applications for delete using (auth.uid() = user_id);

-- Saved jobs
alter table public.saved_jobs enable row level security;
create policy "Users can manage own saved jobs" on public.saved_jobs for all using (auth.uid() = user_id);

-- Swipe history
alter table public.swipe_history enable row level security;
create policy "Users can manage own swipe history" on public.swipe_history for all using (auth.uid() = user_id);

-- User skills
alter table public.user_skills enable row level security;
create policy "Users can manage own skills" on public.user_skills for all using (auth.uid() = user_id);

-- Skill gaps
alter table public.skill_gaps enable row level security;
create policy "Users can manage own skill gaps" on public.skill_gaps for all using (auth.uid() = user_id);

-- Watchlist
alter table public.watchlist_companies enable row level security;
create policy "Users can manage own watchlist" on public.watchlist_companies for all using (auth.uid() = user_id);

-- Coaching sessions
alter table public.coaching_sessions enable row level security;
create policy "Users can manage own coaching sessions" on public.coaching_sessions for all using (auth.uid() = user_id);

-- Tailored resumes
alter table public.tailored_resumes enable row level security;
create policy "Users can manage own tailored resumes" on public.tailored_resumes for all using (auth.uid() = user_id);

-- Stamps
alter table public.stamps enable row level security;
create policy "Users can manage own stamps" on public.stamps for all using (auth.uid() = user_id);

-- Parsed resumes
alter table public.parsed_resumes enable row level security;
create policy "Users can manage own parsed resumes" on public.parsed_resumes for all using (auth.uid() = user_id);

-- Resume chunks
alter table public.resume_chunks enable row level security;
create policy "Users can manage own resume chunks" on public.resume_chunks for all using (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
create index idx_applications_user on public.applications(user_id);
create index idx_applications_job on public.applications(job_id);
create index idx_applications_status on public.applications(status);
create index idx_saved_jobs_user on public.saved_jobs(user_id);
create index idx_swipe_history_user on public.swipe_history(user_id);
create index idx_user_skills_user on public.user_skills(user_id);
create index idx_jobs_active on public.jobs(is_active);
create index idx_coaching_sessions_user on public.coaching_sessions(user_id);

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
