-- 뺄래 낼래 미니앱 — Supabase 스키마
-- 실행: Supabase 콘솔 > SQL Editor 에서 전체 복붙 실행. 재실행 안전(if not exists / drop if exists).
--
-- 토스 로그인 사용자의 누적 기록(기기 변경 보존)을 한 곳에 모은다.
-- 비로그인 유저는 클라이언트 localStorage 만 사용하고 이 테이블에 row 를 만들지 않는다.

-- =========================================================
-- 1) plnl_aits_users
-- =========================================================
create table if not exists public.plnl_aits_users (
  id bigserial primary key,
  -- 토스 로그인 사용자 식별자(콘솔 발급, 안정적). 모든 row 식별 기준.
  toss_user_key text unique not null,
  -- 한 달 운동 비용(원). 진실 숫자의 기준값.
  fee integer not null default 100000 check (fee >= 0),
  -- 이번 달 목표 운동 횟수.
  target integer not null default 12 check (target >= 1),
  -- 출석 기록 { 'YYYY-MM-DD': 'done' | 'missed' }.
  logs jsonb not null default '{}'::jsonb,
  -- 누적 포인트(음수 불가).
  points integer not null default 0 check (points >= 0),
  -- 보유 스트릭 보호권 수.
  freezes integer not null default 0 check (freezes >= 0),
  -- 수령 완료한 스트릭 마일스톤 일수 목록(중복 지급 방지).
  claimed_milestones integer[] not null default '{}'::integer[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 기존 테이블 idempotent 마이그레이션 (컬럼 추가)
alter table public.plnl_aits_users add column if not exists fee integer not null default 100000;
alter table public.plnl_aits_users add column if not exists target integer not null default 12;
alter table public.plnl_aits_users add column if not exists logs jsonb not null default '{}'::jsonb;
alter table public.plnl_aits_users add column if not exists points integer not null default 0;
alter table public.plnl_aits_users add column if not exists freezes integer not null default 0;
alter table public.plnl_aits_users add column if not exists claimed_milestones integer[] not null default '{}'::integer[];

create index if not exists plnl_aits_users_toss_user_key_idx
  on public.plnl_aits_users(toss_user_key);

-- =========================================================
-- 2) updated_at 자동 갱신 트리거
-- =========================================================
create or replace function public.plnl_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plnl_aits_users_set_updated_at on public.plnl_aits_users;
create trigger plnl_aits_users_set_updated_at
  before update on public.plnl_aits_users
  for each row execute function public.plnl_set_updated_at();

-- =========================================================
-- 3) RLS — MVP (사업자 통과 전)
-- =========================================================
-- ⚠️ MVP 단계: 클라이언트가 anon key 로 직접 read/write. 누군가 다른 user_key 를 알면
-- 그 row 를 조작할 수 있다(결제·민감정보 없음 → MVP 감수). 사업자 통과 후 rls-tighten.sql
-- 로 anon 정책 제거 + 백엔드 액션 라우트(docs/backend)만 통과시켜 points/freezes 변조 차단.
alter table public.plnl_aits_users enable row level security;

drop policy if exists "MVP: anon read" on public.plnl_aits_users;
create policy "MVP: anon read" on public.plnl_aits_users for select to anon using (true);

drop policy if exists "MVP: anon insert" on public.plnl_aits_users;
create policy "MVP: anon insert" on public.plnl_aits_users for insert to anon with check (true);

drop policy if exists "MVP: anon update" on public.plnl_aits_users;
create policy "MVP: anon update" on public.plnl_aits_users for update to anon using (true) with check (true);
