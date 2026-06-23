-- 뺄래 낼래 — RLS 잠금 (사업자 통과 + 백엔드 액션 라우트 배포 후 실행)
-- 실행: Supabase 콘솔 > SQL Editor. 재실행 안전(drop if exists).
--
-- 목적: MVP 단계의 anon allow-all 정책을 제거해 클라이언트 anon key 의 supabase 직접 read/write 를
--       차단한다. 이후 모든 쓰기는 백엔드 액션 라우트(/api/aits/user/*, service_role)만 통과 →
--       points / freezes / frozen 변조 차단 (docs/backend 참고).
--
-- ⚠️ 실행 전제(순서 중요):
--   1) 미니앱 클라(src/lib/userData.ts)의 쓰기 경로가 액션 라우트(callBackend)로 전환 완료
--   2) /auth/me 로 읽기도 백엔드 경유
--   위가 안 된 상태에서 실행하면 클라가 supabase 에 직접 접근 못 해 동작이 깨진다(MVP 회귀).

alter table public.plnl_aits_users enable row level security;

-- MVP allow-all 정책 제거 (schema.sql 의 "MVP: anon *" 3종).
drop policy if exists "MVP: anon read" on public.plnl_aits_users;
drop policy if exists "MVP: anon insert" on public.plnl_aits_users;
drop policy if exists "MVP: anon update" on public.plnl_aits_users;

-- 이후 anon/authenticated 용 정책이 하나도 없으므로 기본 거부(deny by default).
-- service_role(백엔드 db.ts getSupabase)은 RLS 를 우회하므로 액션 라우트는 정상 동작한다.
-- 별도 deny 정책은 불필요.
