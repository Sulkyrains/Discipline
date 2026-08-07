-- Discipline v1 数据库结构（在 Supabase SQL Editor 中执行）
-- 数据表统一使用 jsonb 存储业务对象，id 由客户端生成（uuid），updated_at 用于最后写入胜出合并。

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  school text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.timetables (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  icon text not null
);

create table if not exists public.user_achievements (
  owner_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  unlocked_at timestamptz not null default now(),
  primary key (owner_id, achievement_id)
);

insert into public.achievements (id, name_zh, name_en, icon) values
  ('first_focus', '初识专注', 'First Focus', '🌱'),
  ('sessions_10', '习惯成自然', '10 Sessions', '🎯'),
  ('sessions_25', '专注达人', '25 Sessions', '🏅'),
  ('minutes_100', '百炼成钢', '100 Minutes', '⏳'),
  ('minutes_500', '专注宗师', '500 Minutes', '🏆'),
  ('streak_3', '三日之约', '3-Day Streak', '🔥'),
  ('streak_7', '周冠军', '7-Day Streak', '⚡'),
  ('tasks_10', '任务清道夫', 'Task Sweeper', '🧹'),
  ('tasks_100', '任务大师', 'Task Master', '👑')
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.timetables enable row level security;
alter table public.todos enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.feedback enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

create policy "profiles own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "settings own row" on public.settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "timetables own rows" on public.timetables
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "todos own rows" on public.todos
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "focus_sessions own rows" on public.focus_sessions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "feedback own rows" on public.feedback
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "achievements readable" on public.achievements
  for select using (auth.role() = 'authenticated');

create policy "user_achievements own rows" on public.user_achievements
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists idx_timetables_owner on public.timetables (owner_id);
create index if not exists idx_todos_owner on public.todos (owner_id);
create index if not exists idx_focus_sessions_owner on public.focus_sessions (owner_id);
create index if not exists idx_feedback_owner on public.feedback (owner_id);
