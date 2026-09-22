-- 플랜두씨 다이어리 1 (과제 6) — Supabase(Postgres) 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에서 이 파일 전체를 그대로 실행하세요.
-- 로그인 기능이 없는 과제이므로, RLS(Row Level Security)는 "누구나 읽기/쓰기 가능"으로 열어 둡니다.
-- (잠그는 작업은 7번 과제에서 진행합니다. 그 전까지는 링크를 아는 사람은 누구나 보고 고칠 수 있습니다.)

create extension if not exists "pgcrypto";

-- 1) 계획
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_start date not null,
  period_end date not null,
  priority text not null check (priority in ('상', '중', '하')),
  success_criteria text not null,
  estimated_minutes integer not null check (estimated_minutes >= 0),
  note text default '',                 -- 회고에서 넘어온 "고칠 점"을 담는 자유 메모
  carried_from_review_id uuid,          -- 이 계획이 어느 회고 메모에서 이어졌는지(추적용)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 계획 수정 이력 — 계획을 고쳐도 "고치기 전" 내용이 그대로 남도록 스냅샷을 별도 저장
create table if not exists plan_revisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  snapshot jsonb not null,       -- 고치기 전 plans 행 전체 스냅샷
  revised_at timestamptz not null default now()
);

-- 3) 할 일
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
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

create index if not exists idx_todos_plan_id on todos(plan_id);
create index if not exists idx_todos_status on todos(status);
create index if not exists idx_todos_due_date on todos(due_date);

-- 4) 실행 기록 (Do 로그) — 계획/할 일과 별개로 "실제로 한 일"을 기록
create table if not exists executions (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references todos(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  actual_minutes numeric not null check (actual_minutes >= 0),
  blocked_reason text,             -- 막혔던 이유(선택). 있으면 "막힘"으로 집계
  created_at timestamptz not null default now()
);

create index if not exists idx_executions_todo_id on executions(todo_id);

-- 5) 돌아보기에서 다음 계획으로 넘기는 "고칠 점" 메모
create table if not exists review_notes (
  id uuid primary key default gen_random_uuid(),
  note text not null,
  carried_to_plan_id uuid references plans(id),
  created_at timestamptz not null default now()
);

-- ---------- RLS: 로그인 없는 과제이므로 익명 전체 허용 ----------
alter table plans enable row level security;
alter table plan_revisions enable row level security;
alter table todos enable row level security;
alter table executions enable row level security;
alter table review_notes enable row level security;

drop policy if exists anon_all_plans on plans;
create policy anon_all_plans on plans for all using (true) with check (true);

drop policy if exists anon_all_plan_revisions on plan_revisions;
create policy anon_all_plan_revisions on plan_revisions for all using (true) with check (true);

drop policy if exists anon_all_todos on todos;
create policy anon_all_todos on todos for all using (true) with check (true);

drop policy if exists anon_all_executions on executions;
create policy anon_all_executions on executions for all using (true) with check (true);

drop policy if exists anon_all_review_notes on review_notes;
create policy anon_all_review_notes on review_notes for all using (true) with check (true);
