# 뺄래 낼래 미니앱 백엔드 라우트 reference

이 폴더는 **별도 Next.js 레포(`plnl.vercel.app`)에 복사해서 사용**하는 서버 라우트 설계서입니다.
미니앱 vite 빌드(`src/`)에는 포함되지 않아요. v1 MVP 는 백엔드 없이 supabase 직접(anon)으로
동작하고, 사업자 통과 후 아래 라우트로 하드닝합니다.

## 왜 백엔드가 필요한가 (D 담당 영역)

1. **토스 로그인** — `authorizationCode` → 토스 OAuth(mTLS) → PII 복호화 → 자체 세션 JWT.
   클라이언트가 직접 못 하는 mTLS/시크릿 작업.
2. **points/freezes 변조 방지** — 회수율은 '진실 숫자'라 조작 불가지만(클라 계산), 포인트·보호권은
   보상 경제라 클라가 임의 값을 supabase 에 쓰면 안 됨 → 액션 라우트가 서버에서 계산.
3. **월말 트리거 · 알림** — 월 경계에 결산/표창장 "도착" 푸시 발송(Vercel Cron → sendMessage).

## 라우트 구성 (`/api/aits/*`)

| 라우트 | body | 응답 | 비즈니스 검증 |
|---|---|---|---|
| `POST /auth/login` | `{ authorizationCode, referrer }` | `{ sessionToken, refreshToken, userKey, profile }` | 토스 OAuth(mTLS) + PII 복호화 + row upsert + JWT(14d) 발급 |
| `POST /auth/refresh` | `{ refreshToken }` | `{ sessionToken }` | refresh JWT 검증 → access(1h) 재발급 |
| `GET /auth/me` | — (Bearer) | `{ user: PlnlRow \| null }` | 세션 검증 → 서버 row 반환(기기 변경 보존 로드) |
| `POST /auth/disconnect` | (토스 콜백, Basic Auth) | 200 | 토스 콘솔 "연결 끊기" 시 row 정리 |
| `POST /user/checkin` | `{ date, value }` | `{ logs, points }` | 날짜/값 검증. 신규 기록 시 +1P(로그인). 미래·기록경계 차단. 같은 값 토글 오프 |
| `POST /user/claim-milestone` | `{ d }` | `{ points, claimed }` | 스트릭 d 도달 + 미수령 검증. +보너스P. 중복 지급 차단 |
| `POST /user/buy-freeze` | — | `{ points, freezes }` | 포인트 ≥ 5 검증. -5P, +1 보호권 |
| `POST /user/claim-freeze-ad` | `{ adToken? }` | `{ freezes }` | 보상형 광고 시청 검증(가능하면 서버 검증) → +1 보호권 |
| `POST /user/resolve-repair` | `{ accept }` | `{ freezes, frozen, logs }` | 서버가 메울 날 직접 계산(detect). accept→frozen+차감 / 거절→missed 기록 |
| `POST /user/settings` | `{ fee?, target? }` | `{ fee, target }` | fee≥0 / target≥1 검증 |
| `GET\|POST /push/send` | (Cron `Bearer CRON_SECRET` 또는 `x-aits-push-secret`) | `{ sent, skipped, failed }` | 외부 호출 차단. 직전 달 회수율 분기 → 토스 sendMessage(mTLS) |

> 클라이언트(`src/lib/userData.ts`)는 현재 MVP 라 supabase 직접 upsert(`saveRemoteState`)를 쓴다.
> 위 액션 라우트로 옮기면 `userData.ts` 의 TODO(하드닝) 주석대로 callBackend 경유로 교체.

## 구현 현황 (인증 + 액션 라우트 + 월말 푸시 — 이식 완료 ✅)

이 폴더에 **인증·액션·푸시 라우트와 라이브러리가 plnl 용으로 이식 완료**되어 있습니다 (sajumon 패턴, `plnl_aits_users` 적응):

**인증 (F6):**
- ✅ `api-aits-auth-login.ts` — 토스 OAuth(mTLS) → 세션 JWT 발급 (row 자동생성 안 함)
- ✅ `api-aits-auth-me.ts` — 세션 검증 → `PlnlRow | null` 반환 (기기변경 보존 로드)
- ✅ `api-aits-auth-refresh.ts` — refresh → access 재발급
- ✅ `api-aits-auth-disconnect.ts` — 토스 연결 끊기 콜백(Basic Auth) → row 삭제

**사용자 액션 (서버 권위 — points/freezes/frozen 변조 방지, F2/F8/F11):**
- ✅ `lib-aits-userActions.ts` — checkin·claimMilestone·buyFreeze·freezeFromAd·settings·resolveRepair reducer (클라 `src/lib` 와 1:1)
- ✅ `lib-aits-route.ts` — 액션 공통 래퍼(세션검증·레이트리밋·로드·upsert·reason→status)
- ✅ `api-aits-user-{checkin,claim-milestone,buy-freeze,claim-freeze-ad,resolve-repair,settings}.ts` (6)

**월말 푸시 (F17 서버측):**
- ✅ `api-aits-push-send.ts` — Cron 전용(secret 게이트) → 직전 달 결산/표창장 도착 발송
- ✅ `lib-aits-settlement.ts` — 직전 달 회수율 톤 분기 메시지(졸업장/표창장) 빌더
- ✅ `vercel.cron.json` — 매월 1일 09:00 KST cron 샘플

**공통 라이브러리:**
- ✅ `lib-aits-{tossApi,pii,session,ratelimit}.ts` + `lib-aits-db.ts`(supabase·CORS·fetchRow/upsertRow/fetchAllRows, `frozen` 컬럼 포함)

> 클라(`src/lib/userData.ts`)는 아직 MVP 라 supabase 직접 upsert. 위 라우트 배포 후 `userData.ts`
> 의 쓰기 경로를 `callBackend("/user/*")` 로 전환하고 `supabase/rls-tighten.sql` 실행(anon 차단).

> 위 파일들은 `plnl.vercel.app`(별도 Next.js 레포)의 `app/api/aits/*` · `lib/aits/*` 로 복사해 사용.
> 실제 동작에는 mTLS 인증서·PII 키(사업자 통과 후 콘솔 발급) + Vercel 환경변수 등록 필요.

## 월말 트리거 / 알림 (기획 §7 · 업무분장 D)

```
Vercel Cron (매월 1일 09:00 KST)
  → POST /api/aits/push/send  (x-aits-push-secret)
      → 지난달 회수율로 결산/표창장 "도착" 메시지 분기
        (100% → 호구 졸업장 축하 / 미달 → 후원 표창장 + 다음 달 목표 넛지)
      → 토스 sendMessage(mTLS, userKey bulk)  ※ 스마트 발송 연동 검토
```

- 클라이언트의 `isMonthEnded`(settlement.ts)는 "공개 시점" 판정용. 실제 도착 알림은 이 cron.
- 매일 푸시(출석 독려)는 세그먼트 기반 스마트 발송 검토 (기획 §10 TODO).

## 필요 환경변수 (Vercel)

`TOSS_AITS_CLIENT_CERT` / `_CLIENT_KEY` (mTLS), `TOSS_AITS_BASE_URL`(`https://apps-in-toss-api.toss.im`),
`TOSS_AITS_DECRYPT_KEY` / `_AAD`(PII), `AITS_SUPABASE_URL` / `_SERVICE_ROLE_KEY`(미니앱 전용 인스턴스),
`AITS_SESSION_SECRET`, `CRON_SECRET`(Vercel Cron 자동 헤더) 또는 `AITS_PUSH_CRON_SECRET`(수동 트리거),
`AITS_DISCONNECT_BASIC_USER/PASS`, `AITS_ALLOWED_ORIGINS`,
`UPSTASH_REDIS_REST_URL` / `_TOKEN`(rate limit). 자세한 발급 위치는 sajumon README 표 참고.

⚠️ service_role key·시크릿은 **Vercel 환경변수에만**. git/`.env` 금지.

## 검수·사업자 통과 후 활성화 순서

1. 토스 콘솔 mTLS 인증서·PII 키 발급 → Vercel 환경변수 등록
2. `plnl.vercel.app` 에 위 라우트 + `lib/aits/*` 배포
3. 미니앱 `.env.local` 에 `VITE_AITS_API_BASE=https://plnl.vercel.app/api/aits`
4. `userData.ts` 의 쓰기 경로를 액션 라우트로 전환
5. `supabase/rls-tighten.sql` **실행**(작성 완료) — anon 정책 제거(백엔드 service_role 만 통과)
6. Vercel Cron 등록(`vercel.json` — `vercel.cron.json` 샘플 참고) + `CRON_SECRET` 등록 — 월말 결산·표창장 푸시
