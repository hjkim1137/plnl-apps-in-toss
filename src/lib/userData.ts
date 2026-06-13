// 데이터 저장·동기화 (기획 §5 / 업무분장 D). 기기 변경 시 기록 보존이 핵심 목표.
//
// 경로(sajumon 패턴 이식):
//   - 비로그인: localStorage 만. (단가/회수율/출석은 로그인 없이 사용)
//   - 로그인 + 백엔드(VITE_AITS_API_BASE) 활성: /auth/me 로 서버 row 로드. 쓰기는
//     액션 라우트(docs/backend)로 하드닝하는 게 목표 — v1 MVP 는 supabase 직접 upsert.
//   - 로그인 + 백엔드 비활성(dev/MVP): supabase anon 직접 (RLS allow-all 동안만 동작).
//
// 클라이언트는 비즈니스 로직(calc/attendance/points 등)을 로컬에서 적용하고, 그 결과
// PlnlState 를 영속한다. 로그인 시 mergeForLogin 으로 기기 간 기록을 합친다.

import {
  API_BASE,
  clearStoredSession,
  getStoredSession,
  isAuthConfigured,
  refreshSession,
} from "./auth";
import {
  createInitialState,
  normalizeState,
  type Logs,
  type PlnlState,
} from "./model";
import { supabase } from "./supabase";

const TABLE = "plnl_aits_users";
const STORAGE_KEY = "plnl:state";

// ── 로컬 영속 ─────────────────────────────────────────────────────────────

export function loadLocalState(now: Date = new Date()): PlnlState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    return normalizeState(JSON.parse(raw), now);
  } catch {
    return createInitialState();
  }
}

export function saveLocalState(state: PlnlState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private 모드 등 — 무시(메모리 상태는 유지).
  }
}

// ── 서버 row 매핑 ─────────────────────────────────────────────────────────

interface PlnlRow {
  toss_user_key: string;
  fee: number;
  target: number;
  logs: Logs | null;
  points: number;
  freezes: number;
  claimed_milestones: number[] | null;
}

function rowToState(row: PlnlRow, now: Date): PlnlState {
  // 서버 값으로 PlnlState 구성 후 normalize. 로그인 상태로 표시.
  return normalizeState(
    {
      fee: row.fee,
      target: row.target,
      logs: row.logs ?? {},
      loggedIn: true,
      points: row.points,
      freezes: row.freezes,
      claimed: row.claimed_milestones ?? [],
      freeUsed: 0,
      adUnlocked: false,
    },
    now,
  );
}

function stateToRow(tossUserKey: string, state: PlnlState): PlnlRow {
  return {
    toss_user_key: tossUserKey,
    fee: state.fee,
    target: state.target,
    logs: state.logs,
    points: state.points,
    freezes: state.freezes,
    claimed_milestones: state.claimed,
  };
}

// ── 기기 간 병합 (로그인 시) ──────────────────────────────────────────────
//
// 기기 변경 보존: 서버 기록을 기준으로 하되, 이 기기의 비로그인 출석 기록(logs)이 서버에
// 없으면 합친다. 충돌 시 'done' 우선(출석은 살리는 방향). 포인트/보호권/마일스톤은 서버
// 기준(비로그인에선 적립되지 않으므로). 설정(fee/target)은 서버 우선, 없으면 로컬.

export function mergeForLogin(local: PlnlState, remote: PlnlState): PlnlState {
  const logs: Logs = { ...remote.logs };
  for (const [k, v] of Object.entries(local.logs)) {
    if (logs[k] === "done") continue; // 서버가 done 이면 유지
    if (v === "done" || logs[k] == null) logs[k] = v; // 로컬 done 우선, 없던 날 보충
  }
  return {
    ...remote,
    loggedIn: true,
    logs,
    fee: remote.fee || local.fee,
    target: remote.target || local.target,
  };
}

// ── 로드/저장 (환경 분기) ─────────────────────────────────────────────────

export async function loadRemoteState(
  tossUserKey: string,
  now: Date = new Date(),
): Promise<PlnlState> {
  if (isAuthConfigured()) {
    const json = await callBackend<{ user: PlnlRow | null }>("/auth/me", {
      method: "GET",
    });
    return json.user
      ? rowToState(json.user, now)
      : { ...createInitialState(), loggedIn: true };
  }
  // dev/MVP — supabase 직접
  const { data, error } = await supabase
    .from(TABLE)
    .select("toss_user_key, fee, target, logs, points, freezes, claimed_milestones")
    .eq("toss_user_key", tossUserKey)
    .maybeSingle();
  if (error) throw new Error(`loadRemoteState failed: ${error.message}`);
  return data
    ? rowToState(data as PlnlRow, now)
    : { ...createInitialState(), loggedIn: true };
}

export async function saveRemoteState(
  tossUserKey: string,
  state: PlnlState,
): Promise<void> {
  // TODO(하드닝): 사업자 통과 후 points/freezes 변조 방지를 위해 액션 라우트
  //   (/user/checkin, /user/claim-milestone, /user/buy-freeze, /user/settings) 로 분리하고
  //   supabase RLS 를 잠근다(docs/backend 참고). v1 MVP 는 직접 upsert.
  const { error } = await supabase
    .from(TABLE)
    .upsert(stateToRow(tossUserKey, state), { onConflict: "toss_user_key" });
  if (error) throw new Error(`saveRemoteState failed: ${error.message}`);
}

// ── 백엔드 호출 헬퍼 (401 자동 refresh) — sajumon 이식 ─────────────────────

async function callBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getStoredSession();
  if (!session?.sessionToken) throw new Error("no_session");

  const doFetch = (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

  let res = await doFetch(session.sessionToken);
  if (res.status === 401) {
    const newToken = await refreshSession();
    if (!newToken) {
      clearStoredSession();
      throw new SessionExpiredError();
    }
    res = await doFetch(newToken);
    if (res.status === 401) {
      clearStoredSession();
      throw new SessionExpiredError();
    }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new BackendError(res.status, `${path} ${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

// access + refresh 모두 만료. 호출자는 세션 클리어 후 비로그인으로 전환.
export class SessionExpiredError extends Error {
  constructor() {
    super("session_expired");
    this.name = "SessionExpiredError";
  }
}
