alter table public.profiles
  add column if not exists role text check (role in ('business', 'student')),
  add column if not exists context text not null default '';

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  title text not null,
  category text not null,
  description text not null,
  budget integer not null check (budget >= 0),
  deadline date not null,
  skills text[] not null default '{}',
  learning_outcome text not null default '',
  brief_score smallint not null default 0 check (brief_score between 0 and 100),
  brief_completeness text not null default 'low' check (brief_completeness in ('low', 'medium', 'high')),
  ai_summary text not null default '',
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) >= 30),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (project_id, student_id)
);

create table public.student_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  skill_name text not null,
  current_score smallint not null check (current_score between 0 and 100),
  target_score smallint not null check (target_score between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (student_id, skill_name)
);

alter table public.projects enable row level security;
alter table public.applications enable row level security;
alter table public.student_skills enable row level security;

create policy "projects_read_authenticated" on public.projects for select to authenticated using (true);
create policy "projects_insert_business" on public.projects for insert to authenticated with check (auth.uid() = owner_id);
create policy "projects_update_owner" on public.projects for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "applications_read_participants" on public.applications for select to authenticated
  using (auth.uid() = student_id or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "applications_insert_student" on public.applications for insert to authenticated with check (auth.uid() = student_id);
create policy "applications_update_owner" on public.applications for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "skills_manage_own" on public.student_skills for all to authenticated
  using (auth.uid() = student_id) with check (auth.uid() = student_id);

create index projects_owner_id_idx on public.projects(owner_id);
create index applications_project_id_idx on public.applications(project_id);
create index applications_student_id_idx on public.applications(student_id);
create index student_skills_student_id_idx on public.student_skills(student_id);
