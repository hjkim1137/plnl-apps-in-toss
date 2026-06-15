// 뺄래 낼래 미니앱 — Supabase 접근 + CORS 헬퍼 (서버).
// 복사 위치: plnl.vercel.app/lib/aits/db.ts
//
// 미니앱 전용 Supabase 인스턴스(service_role). 클라이언트 src/lib/userData.ts 의 PlnlRow 와
// 동일 스키마(plnl_aits_users). 사용자 액션(checkin/buy-freeze 등)의 서버 권위 로직은
// 별도 lib-aits-userActions.ts(추후 F2/F8/F11) 에서 이 getSupabase()/fetchRow 를 사용한다.

import { createClient } from "@supabase/supabase-js";

export const TABLE = "plnl_aits_users" as const;

// 클라이언트 src/lib/model.ts 의 PlnlState 영속 필드와 1:1 (freeUsed/adUnlocked 은 로컬 전용 → 서버 미저장).
export interface PlnlRow {
  toss_user_key: string;
  fee: number;
  target: number;
  logs: Record<string, "done" | "missed">;
  points: number;
  freezes: number;
  claimed_milestones: number[];
}

let _client: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (_client) return _client;
  _client = createClient(
    process.env.AITS_SUPABASE_URL!,
    process.env.AITS_SUPABASE_SERVICE_ROLE_KEY!,
  );
  return _client;
}

// 사용자 row 조회. 없으면 null (신규 유저 — 클라이언트가 첫 저장 시 생성).
export async function fetchRow(tossUserKey: string): Promise<PlnlRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("toss_user_key, fee, target, logs, points, freezes, claimed_milestones")
    .eq("toss_user_key", tossUserKey)
    .maybeSingle();
  if (error) throw new Error(`fetchRow failed: ${error.message}`);
  return (data as PlnlRow | null) ?? null;
}

// 기본 origin 매처 — 미니앱(`*.apps.tossmini.com`) 화이트리스트. AITS_ALLOWED_ORIGINS
// 환경변수에 `,` 구분으로 등록(와일드카드 `*` 지원).
function isAllowedByEnv(origin: string): boolean {
  const allowed = (process.env.AITS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.some((pattern) => {
    if (pattern === origin) return true;
    if (pattern.includes("*")) {
      const re = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      );
      return re.test(origin);
    }
    return false;
  });
}

// CORS 헤더 헬퍼. 헤더 형태(Allow-Headers/Max-Age 등)는 한 곳에서 관리하고,
// 라우트별로 다른 정책만 opts 로 주입한다. disconnect 라우트는 콘솔(`*.toss.im`)
// 호출 대응으로 자체 matchOrigin + methods 를 넘긴다.
export function corsHeaders(
  req: Request,
  opts: { matchOrigin?: (origin: string) => boolean; methods?: string } = {},
): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = (opts.matchOrigin ?? isAllowedByEnv)(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": opts.methods ?? "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
