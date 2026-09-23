-- 플랜두씨 다이어리 2 (과제 7) — 인증 붙이기용 "별도 표" 스키마
--
-- 과제 6(diary/)이 쓰는 plans/todos/executions/plan_revisions/review_notes 표는
-- 이 파일이 절대 건드리지 않습니다. 같은 Supabase 프로젝트 안에, 과제 7 전용
-- 표(이름 끝에 _t07)를 새로 만들고 거기에만 로그인·소유자 제한을 겁니다.
-- 이렇게 하면 Supabase 무료 요금제의 "프로젝트 2개까지" 제한 안에서,
-- 과제 6 사이트(로그인 없음)는 그대로 살아 있고 과제 7 사이트(로그인 있음)만 따로 잠깁니다.
--
-- 실행 순서: ① 과제 7 앱에서 회원가입을 1번 먼저 마친다 → ② 이 파일 전체를
-- SQL Editor에 붙여넣고 한 번에 실행한다.

create extension if not exists "pgcrypto";

-- =========================================================
-- STEP 1. 과제 7 전용 표 5개 생성 (과제 6 표와 같은 컬럼 + user_id)
-- =========================================================

create table if not exists plans_t07 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  period_start date not null,
  period_end date not null,
  priority text not null check (priority in ('상', '중', '하')),
  success_criteria text not null,
  estimated_minutes integer not null check (estimated_minutes >= 0),
  note text default '',
  carried_from_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plan_revisions_t07 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plan_id uuid not null references plans_t07(id) on delete cascade,
  snapshot jsonb not null,
  revised_at timestamptz not null default now()
);

create table if not exists todos_t07 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plan_id uuid not null references plans_t07(id) on delete cascade,
  title text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'done')),
  due_date date,
  priority text not null default '중' check (priority in ('상', '중', '하')),
  tags text[] not null default '{}',
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_todos_t07_plan_id on todos_t07(plan_id);
create index if not exists idx_todos_t07_status on todos_t07(status);
create index if not exists idx_todos_t07_due_date on todos_t07(due_date);

create table if not exists executions_t07 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  todo_id uuid not null references todos_t07(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  actual_minutes numeric not null check (actual_minutes >= 0),
  blocked_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_executions_t07_todo_id on executions_t07(todo_id);

create table if not exists review_notes_t07 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  note text not null,
  carried_to_plan_id uuid references plans_t07(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- STEP 2. 과제 6 표(plans 등, _t07 아닌 원본)의 자료를 "복사"해 온다
--   (원본은 전혀 지우거나 고치지 않는다 — 과제 6 사이트는 계속 그 표를 그대로 씀)
--   방금 가입한 계정을 소유자로 지정한다("가장 먼저 만들어진 계정" = 지은님 본인)
-- =========================================================
do $$
declare
  owner_id uuid;
begin
  select id into owner_id from auth.users order by created_at asc limit 1;
  if owner_id is null then
    raise exception '가입된 계정이 없습니다. 먼저 과제 7 앱에서 회원가입을 1번 하고 이 SQL을 실행하세요.';
  end if;

  insert into plans_t07 (id, user_id, title, period_start, period_end, priority, success_criteria,
                          estimated_minutes, note, carried_from_review_id, created_at, updated_at)
  select id, owner_id, title, period_start, period_end, priority, success_criteria,
         estimated_minutes, note, carried_from_review_id, created_at, updated_at
  from plans
  where not exists (select 1 from plans_t07 where plans_t07.id = plans.id);

  insert into plan_revisions_t07 (id, user_id, plan_id, snapshot, revised_at)
  select id, owner_id, plan_id, snapshot, revised_at
  from plan_revisions
  where not exists (select 1 from plan_revisions_t07 where plan_revisions_t07.id = plan_revisions.id);

  insert into todos_t07 (id, user_id, plan_id, title, status, due_date, priority, tags,
                          estimated_minutes, completed_at, created_at, updated_at)
  select id, owner_id, plan_id, title, status, due_date, priority, tags,
         estimated_minutes, completed_at, created_at, updated_at
  from todos
  where not exists (select 1 from todos_t07 where todos_t07.id = todos.id);

  insert into executions_t07 (id, user_id, todo_id, started_at, ended_at, actual_minutes,
                               blocked_reason, created_at)
  select id, owner_id, todo_id, started_at, ended_at, actual_minutes, blocked_reason, created_at
  from executions
  where not exists (select 1 from executions_t07 where executions_t07.id = executions.id);

  insert into review_notes_t07 (id, user_id, note, carried_to_plan_id, created_at)
  select id, owner_id, note, carried_to_plan_id, created_at
  from review_notes
  where not exists (select 1 from review_notes_t07 where review_notes_t07.id = review_notes.id);
end $$;

-- =========================================================
-- STEP 3. RLS: _t07 표는 "로그인한 본인 것만". 원본 표(plans 등)는 절대 건드리지 않는다.
-- =========================================================
alter table plans_t07          enable row level security;
alter table plan_revisions_t07 enable row level security;
alter table todos_t07          enable row level security;
alter table executions_t07     enable row level security;
alter table review_notes_t07   enable row level security;

drop policy if exists own_rows_plans_t07          on plans_t07;
drop policy if exists own_rows_plan_revisions_t07 on plan_revisions_t07;
drop policy if exists own_rows_todos_t07          on todos_t07;
drop policy if exists own_rows_executions_t07     on executions_t07;
drop policy if exists own_rows_review_notes_t07   on review_notes_t07;

-- to authenticated 로 제한: 로그인하지 않은 요청(anon 역할)에는 해당 정책이 아예 없어
-- 읽기는 항상 빈 결과, 쓰기는 항상 거절된다.
create policy own_rows_plans_t07 on plans_t07
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_rows_plan_revisions_t07 on plan_revisions_t07
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_rows_todos_t07 on todos_t07
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_rows_executions_t07 on executions_t07
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_rows_review_notes_t07 on review_notes_t07
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- STEP 4. "남의 자료를 수정/삭제하려 하면 403"을 명확한 HTTP 상태로 만드는 함수
--   (RLS만 쓰면 남의 행은 UPDATE/DELETE 대상에서 0건으로 조용히 빠져
--    "실패인지 성공인지" 응답만으로는 구분이 잘 안 된다.
--    아래 함수는 주인이 아니면 Postgres 오류코드 42501(insufficient_privilege)을
--    명시적으로 내고, PostgREST는 이 오류코드를 HTTP 403으로 그대로 번역해 준다.)
-- =========================================================

create or replace function update_todo_secure(
  p_todo_id uuid,
  p_patch jsonb
) returns todos_t07
language plpgsql
security definer
set search_path = public
as $$
declare
  result todos_t07;
begin
  if not exists (select 1 from todos_t07 where id = p_todo_id and user_id = auth.uid()) then
    raise exception 'forbidden: not the owner of this todo' using errcode = '42501';
  end if;

  update todos_t07 set
    title              = coalesce(p_patch->>'title', title),
    status             = coalesce(p_patch->>'status', status),
    due_date           = case when p_patch ? 'due_date' then (p_patch->>'due_date')::date else due_date end,
    priority           = coalesce(p_patch->>'priority', priority),
    tags               = case when p_patch ? 'tags'
                               then array(select jsonb_array_elements_text(p_patch->'tags'))
                               else tags end,
    estimated_minutes  = coalesce((p_patch->>'estimated_minutes')::int, estimated_minutes),
    completed_at       = case when p_patch ? 'completed_at'
                               then nullif(p_patch->>'completed_at','')::timestamptz
                               else completed_at end,
    updated_at         = now()
  where id = p_todo_id and user_id = auth.uid()
  returning * into result;

  return result;
end;
$$;

create or replace function delete_todo_secure(p_todo_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from todos_t07 where id = p_todo_id and user_id = auth.uid()) then
    raise exception 'forbidden: not the owner of this todo' using errcode = '42501';
  end if;
  delete from todos_t07 where id = p_todo_id and user_id = auth.uid();
end;
$$;

create or replace function update_plan_secure(
  p_plan_id uuid,
  p_patch jsonb
) returns plans_t07
language plpgsql
security definer
set search_path = public
as $$
declare
  result plans_t07;
begin
  if not exists (select 1 from plans_t07 where id = p_plan_id and user_id = auth.uid()) then
    raise exception 'forbidden: not the owner of this plan' using errcode = '42501';
  end if;

  update plans_t07 set
    title              = coalesce(p_patch->>'title', title),
    period_start       = coalesce((p_patch->>'period_start')::date, period_start),
    period_end         = coalesce((p_patch->>'period_end')::date, period_end),
    priority           = coalesce(p_patch->>'priority', priority),
    success_criteria   = coalesce(p_patch->>'success_criteria', success_criteria),
    estimated_minutes  = coalesce((p_patch->>'estimated_minutes')::int, estimated_minutes),
    note               = coalesce(p_patch->>'note', note),
    updated_at         = now()
  where id = p_plan_id and user_id = auth.uid()
  returning * into result;

  return result;
end;
$$;

revoke all on function update_todo_secure(uuid, jsonb) from public;
revoke all on function delete_todo_secure(uuid) from public;
revoke all on function update_plan_secure(uuid, jsonb) from public;
grant execute on function update_todo_secure(uuid, jsonb) to authenticated;
grant execute on function delete_todo_secure(uuid) to authenticated;
grant execute on function update_plan_secure(uuid, jsonb) to authenticated;

-- =========================================================
-- 끝. 확인용 쿼리(선택)
-- select count(*) from plans_t07;                 -- 과제 6 계획 수와 같아야 정상
-- select count(*) from plans;                      -- 과제 6 원본은 그대로인지(행 수 그대로)
-- select policyname, cmd, roles from pg_policies where tablename like '%_t07';
-- =========================================================
