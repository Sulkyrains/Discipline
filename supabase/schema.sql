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

alter table public.feedback add column if not exists status text not null default 'pending';
alter table public.feedback add column if not exists reply text;

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

-- Discipline v2: 线上自习室
create table if not exists public.study_rooms (
  id uuid primary key,
  code text not null unique,
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  max_members int not null default 20,
  created_at timestamptz not null default now()
);

alter table public.study_rooms enable row level security;

create policy "study_rooms readable by authenticated" on public.study_rooms
  for select using (auth.role() = 'authenticated');

create policy "study_rooms owner insert" on public.study_rooms
  for insert with check (auth.uid() = owner_id);

create policy "study_rooms owner delete" on public.study_rooms
  for delete using (auth.uid() = owner_id);

create index if not exists idx_study_rooms_code on public.study_rooms (code);

-- Discipline v2.0.12: 反馈管理后台
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "admins readable by authenticated" on public.admins
  for select using (auth.role() = 'authenticated');

create policy "feedback admins read all" on public.feedback
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "feedback admins update all" on public.feedback
  for update using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Discipline v2.0.4: 昵称映射与头像
alter table public.profiles add column if not exists auth_email text;

create unique index if not exists idx_profiles_nickname_lower on public.profiles (lower(nickname));

create or replace function public.get_auth_email_by_nickname(p_nickname text)
returns text
language sql
security definer
set search_path = public
as $$
  select auth_email from public.profiles where lower(nickname) = lower(p_nickname) limit 1;
$$;

grant execute on function public.get_auth_email_by_nickname(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars own upload" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars own update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars own delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
