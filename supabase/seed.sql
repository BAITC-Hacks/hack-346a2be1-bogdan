-- Безопасные демонстрационные данные, не связанные с auth.users.
-- Они предназначены для просмотра схемы в SQL Editor. Приложение использует
-- встроенный demo-режим до подключения реального пользователя Supabase Auth.
create table if not exists public.demo_skill_gaps (
  skill_name text primary key,
  current_score smallint not null,
  target_score smallint not null,
  recommendation text not null
);

alter table public.demo_skill_gaps enable row level security;

drop policy if exists "demo_skill_gaps_read" on public.demo_skill_gaps;
create policy "demo_skill_gaps_read" on public.demo_skill_gaps for select using (true);

insert into public.demo_skill_gaps (skill_name, current_score, target_score, recommendation)
values
  ('Работа с AI-инструментами', 82, 90, 'Автоматизировать один повторяющийся рабочий сценарий.'),
  ('Промпт-инжиниринг', 64, 85, 'Собрать библиотеку проверяемых шаблонов запросов.'),
  ('Анализ данных', 48, 80, 'Разобрать практический кейс и оформить выводы в дашборд.')
on conflict (skill_name) do update set
  current_score = excluded.current_score,
  target_score = excluded.target_score,
  recommendation = excluded.recommendation;
