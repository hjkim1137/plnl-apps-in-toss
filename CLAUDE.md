# 뺄래 낼래 (plnl-apps-in-toss)

운동비 회수율 동기부여 앱인토스 미니앱. 스택: Vite + React 18 + TypeScript + TDS(@toss/tds-mobile) + @apps-in-toss/web-framework + Supabase.

## 핵심 원칙

- **진실 숫자 불가침**: 회수율/단가/기부액(`lib/calc.ts`)은 포인트·보상으로 절대 조작 안 됨.
- **로직 ↔ 화면 분리**: 모든 상태·계산·액션은 `src/lib/*` + `src/hooks/usePlnl.ts`(D). 화면은 `src/screens/*`(A)가 `usePlnl()` 만 소비. 카피·등급명·보상값은 `src/lib/content.ts`(B).
- **순수 함수 우선**: `lib/` 의 계산/판정은 부수효과 없는 순수 함수 → 테스트 용이.

## 자주 보는 파일

- 계산엔진 `src/lib/calc.ts`, 구간 `src/lib/brackets.ts`(+카피 `content.ts`)
- 출석 reducer `src/lib/attendance.ts`, 스트릭 `src/lib/streak.ts`
- 광고(전면형/보상형) `src/lib/ads.ts`, 토스 로그인/익명키 `src/lib/auth.ts`
- 동기화(기기변경 보존) `src/lib/userData.ts`, 스키마 `supabase/schema.sql`
- 핸드오프 훅 `src/hooks/usePlnl.ts`

## 미확정 TODO (코드 내 주석으로도 표기)

- 보호권 소비 규칙(streak.ts) · 달력 today 게이팅 정책(attendance.ts)
- 등급 컷/마일스톤 밸런싱(content.ts) · KST 자정 경계(date.ts)
- 백엔드 액션 라우트 하드닝 + RLS 잠금(docs/backend)

## 검증

```bash
npm run typecheck   # 타입
npm run dev         # 실행 (env 비어도 dev mock 으로 전 기능 동작)
```
