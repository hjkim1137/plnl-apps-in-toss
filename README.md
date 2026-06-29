# 뺄래 낼래 (plnl-apps-in-toss)

운동 결제 비용 대비 방문 성실도를 **1회 단가 / 회수율 / 누적 기부액**으로 환산해 동기부여하는 앱인토스 미니앱.

> "안 가면 그냥 헬스장에 기부하는 셈" — 회수율을 게임처럼.

## 시작하기

```bash
npm install
cp .env.example .env.local   # 값은 비워둬도 dev mock 으로 전 기능 동작
npm run dev
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | granite dev 서버 (실기기 토스 샌드박스 연결 가능) |
| `npm run build` / `npm run deploy` | 앱인토스 빌드 / 배포 |
| `npm run typecheck` | 타입 체크 |
| `npm run test:logic` | `src/lib` 순수 로직 단위 테스트 (Node 22+) |
| `npm run lint` / `npm run format` | eslint / prettier |

## 구조 (담당 분리)

```
src/
├── main.tsx              # 엔트리 (TDS Provider)
├── App.tsx               # 환경 가드 + 탭 셸  ← 화면 상세는 멤버2
├── screens/              # 오늘 / 월간 현황 탭  ← 멤버2 작업 영역 (현재 플레이스홀더)
├── hooks/
│   └── usePlnl.ts        # ★ 모든 상태·액션을 노출하는 핸드오프 훅 (멤버1→멤버2)
└── lib/                  # ★ 개발자(멤버1) 로직 레이어 — 화면 무관, 순수/테스트 가능
    ├── date.ts           # 날짜 유틸 (KST 기준)
    ├── constants.ts      # 무료횟수·보호권가격 등 정책 상수
    ├── model.ts          # PlnlState / 서버 row 타입 + 정규화
    ├── calc.ts           # 회수율·단가·기부액·본전 계산엔진
    ├── brackets.ts       # 회수율 7구간 판정 (키만 — 카피/색은 content)
    ├── attendance.ts     # 출석 체크 reducer (무료3회·로그인 분기)
    ├── streak.ts         # 연속 출석 / 최장 연속
    ├── titles.ts         # 대표 칭호(누적 레벨) 판정
    ├── milestones.ts     # 스트릭 마일스톤 수령(중복 방지)
    ├── freeze.ts         # 스트릭 보호권 (포인트/광고)
    ├── settlement.ts     # 월말 판정 + 결산/표창장 데이터 생성
    ├── content.ts        # 카피·등급명·보상값 ← 멤버3/멤버2 조정 영역
    ├── environment.ts    # 토스 WebView 환경 판별
    ├── auth.ts           # 토스 로그인 / 익명키 / 세션
    ├── ads.ts            # 전면형 + 보상형 광고 (시청완료 판정)
    ├── supabase.ts       # supabase 클라 (anon)
    └── userData.ts       # 로컬↔서버 동기화 + 액션 라우트 (기기변경 보존)
docs/backend/             # 별도 vercel 레포에 복사할 백엔드 라우트 레퍼런스
supabase/schema.sql       # plnl_aits_users 테이블 스키마
```

### 멤버1 / 멤버2 / 멤버3 핸드오프

- **멤버1**: `src/lib/*` + `src/hooks/usePlnl.ts` + 스캐폴딩 + 인증/광고/동기화 + 스키마/백엔드.
- **멤버2**: `src/screens/*` 화면을 `usePlnl()` 가 주는 값/액션으로 TDS 컴포넌트로 구현.
- **멤버3**: `src/lib/content.ts` 의 카피·등급명·보상값·표창장 문구 정제.

멤버2 는 로직을 몰라도 됩니다 — `const plnl = usePlnl()` 한 줄이면 `plnl.today.rate`, `plnl.actions.checkIn('done')` 처럼 전부 꺼내 씁니다.

## 참고

- 인증/광고 패턴은 `sajumon-apps-in-toss` 에서 이식.
- 백엔드(`docs/backend/`)는 이 vite 빌드에 포함되지 않고, 별도 Next.js 레포(`plnl.vercel.app`)에 복사해 사용.
- [앱인토스 콘솔](https://apps-in-toss.toss.im/) · [개발자센터](https://developers-apps-in-toss.toss.im/)
