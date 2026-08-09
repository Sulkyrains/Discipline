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
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.todos (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.feedback add column if not exists status text not null default 'pending';
alter table public.feedback add column if not exists reply text;
alter table public.feedback add column if not exists messages jsonb not null default '[]'::jsonb;
alter table public.feedback alter column owner_id drop not null;

create policy "feedback anon insert" on public.feedback
  for insert with check (owner_id is null);

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
  ('tasks_100', '任务大师', 'Task Master', '👑'),
  ('first_todo', '旗开得胜', 'First Task', '📝'),
  ('tasks_50', '任务清道夫', 'Task Sweeper II', '🧹'),
  ('tasks_200', '百战无前', 'Task Legend', '🏆'),
  ('sessions_50', '专注成瘾', '50 Sessions', '⏳'),
  ('sessions_100', '专注传奇', '100 Sessions', '⚡'),
  ('minutes_1000', '千锤百炼', '1000 Minutes', '🌄'),
  ('minutes_5000', '专注神话', '5000 Minutes', '🏅'),
  ('streak_14', '半月之恒', '14-Day Streak', '🌱'),
  ('streak_30', '月度王者', '30-Day Streak', '🌳'),
  ('active_7', '渐入佳境', '7 Active Days', '🗓️'),
  ('active_30', '满月勋章', '30 Active Days', '📆'),
  ('early_bird', '早起的鸟儿', 'Early Bird', '🌅'),
  ('night_owl', '夜猫子', 'Night Owl', '🌙'),
  ('task_focus_10', '目标锁定', 'Task Focuser', '🎯'),
  ('week_200', '当周之星', 'Week Champion', '⚡'),
  ('month_600', '满月归途', 'Month Climber', '🌕'),
  ('signin_first', '初次签到', 'First Check-in', '📅'),
  ('signin_streak_7', '七日签到', '7-Day Sign-in Streak', '🗓️'),
  ('signin_streak_30', '全勤一月', '30-Day Sign-in Streak', '🏵️'),
  ('signin_total_30', '签到新秀', '30 Total Sign-ins', '💮'),
  ('signin_total_100', '签到元老', '100 Total Sign-ins', '💎'),
  ('checkin_streak_14', '半月之约', '14-Day Check-in Streak', '🥈'),
  ('checkin_streak_30', '月度王者', '30-Day Check-in Streak', '🥇'),
  ('checkin_total_50', '半百征程', '50 Total Check-ins', '🏔️'),
  ('checkin_total_100', '百日登峰', '100 Total Check-ins', '🗻'),
  ('tasks3_day', '高效一日', 'Three Tasks a Day', '✅'),
  ('hours_50', '五十小时', '50 Hours', '⏱️'),
  ('tasks_500', '五百任务', '500 Tasks', '🗃️'),
  ('checkin_total_200', '两百日打卡', '200 Check-ins', '🗻'),
  ('signin_total_365', '全年签到', 'Year of Sign-ins', '🌠')
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
  id text primary key,
  code text not null unique,
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_public boolean not null default false,
  max_members int not null default 20,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

-- Discipline v2.1.5: 既有库请在 SQL Editor 执行：
-- alter table public.study_rooms add column if not exists tags text[] not null default '{}'::text[];

alter table public.study_rooms enable row level security;

create policy "study_rooms readable by authenticated" on public.study_rooms
  for select using (auth.role() = 'authenticated');

create policy "study_rooms owner insert" on public.study_rooms
  for insert with check (auth.uid() = owner_id);

create policy "study_rooms owner delete" on public.study_rooms
  for delete using (auth.uid() = owner_id);

create policy "study_rooms owner update" on public.study_rooms
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists idx_study_rooms_code on public.study_rooms (code);

-- Discipline v2.1.2: 每位用户最多同时加入/创建一个房间
create table if not exists public.study_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  room_id text not null references public.study_rooms (id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.study_memberships enable row level security;

create policy "memberships own row" on public.study_memberships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

create policy "feedback admins delete all" on public.feedback
  for delete using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "profiles admins read" on public.profiles
  for select using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 管理员便捷查询：反馈+提交人昵称/邮箱（仅管理员可调用）
create or replace function public.admin_feedback()
returns table (
  id uuid,
  owner_id uuid,
  data jsonb,
  status text,
  reply text,
  messages jsonb,
  updated_at timestamptz,
  nickname text,
  email text
)
language sql security definer set search_path = public
as $$
  select f.id, f.owner_id, f.data, f.status, f.reply, f.messages, f.updated_at,
         p.nickname,
         (select u.email from auth.users u where u.id = f.owner_id) as email
  from public.feedback f
  left join public.profiles p on p.id = f.owner_id
  where exists (select 1 from public.admins a where a.user_id = auth.uid())
  order by f.updated_at desc
  limit 100;
$$;

grant execute on function public.admin_feedback() to authenticated;

-- 管理员便捷查询：全部用户昵称/邮箱（仅管理员可调用）
create or replace function public.admin_users()
returns table (id uuid, email text, nickname text, display_name text, avatar_url text, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select u.id,
         u.email,
         u.raw_user_meta_data->>'nickname' as nickname,
         u.raw_user_meta_data->>'display_name' as display_name,
         u.raw_user_meta_data->>'avatar_url' as avatar_url,
         u.created_at
  from auth.users u
  where exists (select 1 from public.admins a where a.user_id = auth.uid())
  order by u.created_at desc;
$$;

grant execute on function public.admin_users() to authenticated;

-- Discipline v2.0.4: 昵称映射与头像
alter table public.profiles add column if not exists auth_email text;

create unique index if not exists idx_profiles_nickname_lower on public.profiles (lower(nickname));

-- Discipline v2.1.8: 昵称→邮箱查询限流，防匿名批量枚举绑定邮箱
create table if not exists public.nickname_lookup_attempts (
  nickname text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_nickname_lookup_nickname
  on public.nickname_lookup_attempts (lower(nickname), attempted_at);

-- 仅允许 security definer 函数（属主绕过 RLS）读写；不开放任何策略，
-- 防止匿名用户读取/删除尝试记录从而绕过限流。
alter table public.nickname_lookup_attempts enable row level security;

create or replace function public.get_auth_email_by_nickname(p_nickname text)
returns text
language sql
security definer
set search_path = public
as $$
  with recent as (
    select count(*) as c
    from public.nickname_lookup_attempts
    where lower(nickname) = lower(p_nickname)
      and attempted_at > now() - interval '10 minutes'
  ),
  prune as (
    delete from public.nickname_lookup_attempts
    where attempted_at < now() - interval '1 day'
  ),
  insert_attempt as (
    insert into public.nickname_lookup_attempts (nickname)
    select p_nickname
    where (select c from recent) < 10
    returning 1
  )
  select auth_email
  from public.profiles
  where lower(nickname) = lower(p_nickname)
    and exists (select 1 from insert_attempt)
  limit 1;
$$;

grant execute on function public.get_auth_email_by_nickname(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- v2.1.8 起对头像上传做服务端 image/* 与 10MB 校验；若所用 Supabase 版本
-- 不支持基于 metadata 的策略语法，自动降级为仅目录归属校验，保证上传始终可用。
do $$
begin
  begin
    drop policy if exists "avatars own upload" on storage.objects;
    create policy "avatars own upload" on storage.objects
      for insert with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
        and coalesce(metadata->>'mimetype', metadata->>'contentType') like 'image/%'
        and (metadata->>'size')::bigint <= 10485760
      );
  exception when others then
    raise notice 'avatar metadata policy unsupported, falling back: %', sqlerrm;
    drop policy if exists "avatars own upload" on storage.objects;
    create policy "avatars own upload" on storage.objects
      for insert with check (
        bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
      );
  end;
  begin
    drop policy if exists "avatars own update" on storage.objects;
    create policy "avatars own update" on storage.objects
      for update using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
        and coalesce(metadata->>'mimetype', metadata->>'contentType') like 'image/%'
        and (metadata->>'size')::bigint <= 10485760
      );
  exception when others then
    raise notice 'avatar metadata policy unsupported, falling back: %', sqlerrm;
    drop policy if exists "avatars own update" on storage.objects;
    create policy "avatars own update" on storage.objects
      for update using (
        bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
      );
  end;
  drop policy if exists "avatars own delete" on storage.objects;
  create policy "avatars own delete" on storage.objects
    for delete using (
      bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
    );
end $$;

create policy "avatars own delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
