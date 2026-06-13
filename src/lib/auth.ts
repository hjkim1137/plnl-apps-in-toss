import { appLogin, getAnonymousKey } from "@apps-in-toss/web-framework";

// 토스 로그인 + 자체 세션 토큰 관리. (sajumon 패턴 이식)
// 백엔드 라우트는 docs/backend/ 참고. 별도 Next.js 레포(plnl.vercel.app)에 배포되면 실동작.
// 그 전까지 dev 환경에선 mock 세션으로 흐름 검증 가능.

export const API_BASE = import.meta.env.VITE_AITS_API_BASE ?? "";
const SESSION_KEY = "plnl:session";

export interface TossProfile {
  name: string | null;
  birthday: string | null; // yyyyMMdd
}

export interface Session {
  sessionToken: string; // access JWT (1h)
  refreshToken: string; // refresh JWT (14d)
  userKey: string;
  profile: TossProfile;
}

export function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // private 모드 등 localStorage 접근 불가
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function isAuthConfigured(): boolean {
  return API_BASE.length > 0;
}

// access 만료(401) 시 호출. refresh 도 만료/위조면 null — 호출자가 세션 클리어.
// 동시 다발 401 에도 한 번만 /auth/refresh 호출하도록 in-flight Promise 캐시.
let _refreshInflight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!API_BASE) return null;
  const current = getStoredSession();
  if (!current?.refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sessionToken?: string };
    if (!json.sessionToken) return null;
    saveStoredSession({ ...current, sessionToken: json.sessionToken });
    return json.sessionToken;
  } catch {
    return null;
  }
}

export function refreshSession(): Promise<string | null> {
  if (_refreshInflight) return _refreshInflight;
  _refreshInflight = doRefresh().finally(() => {
    _refreshInflight = null;
  });
  return _refreshInflight;
}

// 토스 appLogin → 백엔드 /auth/login → 세션 발급.
export async function loginWithToss(): Promise<Session> {
  if (!API_BASE) {
    throw new Error("VITE_AITS_API_BASE env not set");
  }
  const { authorizationCode, referrer } = await appLogin();
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorizationCode, referrer }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Login failed: ${res.status} ${detail}`);
  }
  const json = await res.json();
  return {
    sessionToken: json.sessionToken as string,
    refreshToken: json.refreshToken as string,
    userKey: json.userKey as string,
    profile: (json.profile as TossProfile) ?? { name: null, birthday: null },
  };
}

// 비로그인 유저의 안정적 익명 식별키(미니앱별 고유). 기기 로컬 데이터를 식별하거나
// 추후 서버 마이그레이션 키로 사용 가능. 토스 앱 밖에선 reject 될 수 있어 try/catch.
export async function fetchAnonymousKey(): Promise<string | null> {
  try {
    // SDK 버전에 따라 string 또는 { anonymousKey } 형태일 수 있어 양쪽 방어.
    const res: unknown = await getAnonymousKey();
    if (typeof res === "string") return res;
    if (res && typeof res === "object" && "anonymousKey" in res) {
      const v = (res as { anonymousKey?: unknown }).anonymousKey;
      return typeof v === "string" ? v : null;
    }
    return null;
  } catch {
    return null;
  }
}

// 백엔드/사업자 통과 전 임시 mock 세션. dev fallback 전용. prod 호출 금지.
export function makeMockSession(): Session {
  const id = "dev-mock-" + Math.random().toString(36).slice(2, 10);
  return {
    sessionToken: `mock-token-${id}`,
    refreshToken: `mock-refresh-${id}`,
    userKey: id,
    profile: { name: null, birthday: null },
  };
}
