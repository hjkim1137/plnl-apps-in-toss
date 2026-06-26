# plnl 백엔드 API (Vercel 서버리스 함수)

plnl 은 앱인토스 **전용** 서비스(웹 서비스 없음)라, 백엔드를 별도 Next.js 레포로
두지 않고 **이 미니앱 레포 안 `/api/aits/*` 에 plain Vercel 함수로 co-locate** 합니다.

- 미니앱(`src/`)은 `npm run deploy`(`ait deploy`)로 **토스 CDN** 에 배포.
- `/api/*` 함수는 이 레포를 **Vercel** 에 연결해 배포 (한 레포, 두 배포 대상).
- `vercel.json` 이 Vercel 에서 프론트 빌드를 건너뛰고 `/api` 함수만 호스팅하도록 설정.
- 미니앱은 `VITE_AITS_API_BASE = https://<plnl-vercel-도메인>/api/aits` 로 이 API 를 호출.

> 참고: `docs/backend/*.ts`(Next.js App Router `route.ts` 템플릿)는 sajumon 패턴을 본뜬
> 초기 설계서입니다. plnl 은 위 co-locate 방식으로 가므로, 신규 엔드포인트는
> `/api/aits/*` 에 Vercel 함수(`export default function handler(req, res)`)로 추가하세요.

## 엔드포인트

| 메서드 · 경로 | 용도 | 인증 |
|---|---|---|
| `POST /api/aits/auth/disconnect` | 토스 연결 끊기 콜백 → 사용자 row 삭제 | Basic Auth |

(로그인 `/auth/login`, `/auth/refresh`, `/auth/me`, `/push/send` 등은 추후 동일 패턴으로 추가)

## 환경변수 (Vercel > Settings > Environment Variables)

서버 전용. 클라이언트(`VITE_*`)와 분리하며, service_role 키·시크릿은 git 금지.

| 키 | 설명 |
|---|---|
| `AITS_SUPABASE_URL` | PLNL Supabase 프로젝트 URL |
| `AITS_SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** 키 (RLS 우회, 서버 전용) |
| `AITS_DISCONNECT_BASIC_USER` | 연결 끊기 콜백 Basic Auth username — 콘솔에도 동일 등록 |
| `AITS_DISCONNECT_BASIC_PASS` | 연결 끊기 콜백 Basic Auth password (`openssl rand -base64 32`) — 콘솔에도 동일 등록 |

## 토스 콘솔 등록 & 탈퇴 테스트

1. 콘솔 > 연결 끊기 콜백에 `https://<도메인>/api/aits/auth/disconnect` 등록 (POST).
2. Basic Auth user/pass 를 위 env 와 **동일하게** 입력.
3. **"테스트하기"** → `200` 이면 통과 (콘솔은 dummy `userKey:0` 전송 → `{ok:true,deleted:0}`).
4. 실제 탈퇴 검증: Supabase `plnl_aits_users` 에 테스트 row(`toss_user_key='99999'`) 삽입 후
   Basic Auth + `{"userKey":99999,"referrer":"UNLINK"}` POST → row 삭제 확인.
