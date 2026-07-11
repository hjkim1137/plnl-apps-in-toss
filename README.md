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
├── App.tsx               # 환경 가드 + 탭 셸 + 팝업 렌더  ← 화면 상세는 멤버2
├── screens/              # 오늘 / 월간 현황 탭  ← 멤버2 작업 영역 (현재 플레이스홀더)
├── components/
│   ├── AdButton.tsx          # 광고 실행 버튼(스피너·중복탭 가드)
│   ├── PopupShell.tsx        # 공용 중앙 모달 셸(딤+카드)
│   ├── StreakPopup.tsx       # 스트릭 팝업(마일스톤 달성 / 끊김)
│   └── FreezeRepairPopup.tsx # 보호권 복구 제안 팝업
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

## 스트릭 팝업 정책

앱 진입·"오늘 갔어요" 체크·복구 동의/거절 순간에 팝업을 감지한다(`streak.ts` `detectStreakStatusPopup` + `usePlnl`). 팝업은 **동시에 하나만**, 아래 우선순위로 뜬다.

**우선순위**: ① 복구 팝업 → (없으면) ② 마일스톤 팝업 → (없으면) ③ 끊김 팝업 → 없음

모든 팝업은 **로그인 유저 전용**. 확인/지키기 등 confirm 버튼은 강한 햅틱(`success`), 딤 탭은 약한 `tap`.

### ① 보호권 복구 팝업 (`FreezeRepairPopup`) — 최우선

빠진 날을 보호권으로 살릴 수 있으면 다른 팝업보다 먼저 묻는다. 다음을 **모두** 충족할 때:

- 마지막 인증 이후 빈 날(빠진 날)이 있음
- 보유 보호권으로 그 빈 날을 **전부** 메울 수 있음 (all-or-nothing — 3일 비었는데 보호권 2개면 안 뜸)
- 빈 날 중 "안 갔어요(missed)"로 직접 찍은 날이 없음(끊김 수용으로 간주)
- 마지막 인증이 `FREEZE_RECONCILE_LOOKBACK_DAYS`(60일) 이내
- 딤 탭으로 안 닫힘(명시 버튼만). "지키기"=차감·복구, "괜찮아요"=빈 날을 missed 기록(다시 안 물음)

### ② 마일스톤 달성 팝업 (`StreakPopup` kind=milestone) — "🎁 출석 보상 받기"

- **리빙 연속**이 3·7·14·30일 중 하나에 도달, 그 마일스톤 **미수령**
- 그 마일스톤 팝업을 아직 안 봄 (`streakMilestoneSeen`) → **마일스톤당 최초 1회**. 오늘 체크를 토글하거나 다음 날 와도 재노출 안 함
- 수령(광고) 완료 시 `claimed` 기록 → 이후 안 뜸

### ③ 끊김 위로 팝업 (`StreakPopup` kind=broken) — "다시 1일차부터 시작해요 💪"

- **리빙 연속 = 0** (오늘·어제 모두 인증/보호 없음 = 진짜 끊김)
- 잃은 연속 ≥ `BROKEN_MIN_STREAK`(2일) — 1일 끊김은 소음이라 안 띄움
- 이 끊김(마지막 출석일 anchor)을 아직 안 봄 (`streakBrokenSeenOn`) → **끊김당 1회**

### 리빙 스트릭 (livingStreak)

화면·마일스톤 판정은 `currentStreak`(오늘 미체크=0, 푸시용)이 아니라 **`livingStreak`** 를 쓴다: 오늘 체크했으면 오늘 포함, 아직이면 **어제까지 이어온 연속**을 표시(오늘은 유예). 보호권으로 어제 빈 날을 메우면 오늘 인증 전에도 그 연속(예 4일)이 보이고 마일스톤도 활성. 완전히 끊겨야(어제 기준도 0) 0.

> 팝업 노출 마커(`streakMilestoneSeen`·`streakBrokenSeenOn`)는 **기기 로컬 전용**(Supabase 미저장). 자세한 시나리오·seed 는 `docs`(별도) QA 문서 참고.

## 참고

- 인증/광고 패턴은 `sajumon-apps-in-toss` 에서 이식.
- 백엔드(`docs/backend/`)는 이 vite 빌드에 포함되지 않고, 별도 Next.js 레포(`plnl.vercel.app`)에 복사해 사용.
- [앱인토스 콘솔](https://apps-in-toss.toss.im/) · [개발자센터](https://developers-apps-in-toss.toss.im/)
