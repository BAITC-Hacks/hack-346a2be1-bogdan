create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  target_role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_role text not null,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  overall_score smallint check (overall_score between 0 and 100),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.skill_gaps (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  skill_name text not null,
  current_score smallint not null check (current_score between 0 and 100),
  target_score smallint not null check (target_score between 0 and 100),
  recommendation text not null default '',
  priority smallint not null default 2 check (priority between 1 and 3),
  unique (assessment_id, skill_name)
);

alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.skill_gaps enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "assessments_manage_own" on public.assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "skill_gaps_manage_own" on public.skill_gaps for all
  using (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.assessments a where a.id = assessment_id and a.user_id = auth.uid()));

create index assessments_user_id_idx on public.assessments(user_id);
create index skill_gaps_assessment_id_idx on public.skill_gaps(assessment_id);
