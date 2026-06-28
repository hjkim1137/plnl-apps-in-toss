// 뺄래 낼래 미니앱 — Supabase 데이터 접근 (Vercel 서버리스 함수용, co-located).
// 원본: docs/backend/lib-aits-db.ts (Next.js 레포 reference).
//
// 미니앱 전용 Supabase 인스턴스(service_role). 클라이언트 src/lib/userData.ts 의 PlnlRow 와
// 동일 스키마(plnl_aits_users). env 이름은 disconnect.ts 와 동일:
//   AITS_SUPABASE_URL / AITS_SUPABASE_SERVICE_ROLE_KEY.
//
// CORS·body 파싱 등 HTTP 헬퍼는 lib/aits/http.ts 로 분리(이 파일은 데이터 접근만 담당).

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
  /** 보호권으로 보호된 날짜 키 목록. 출석(done)이 아니라 스트릭 연속만 이어줌(streak.ts). */
  frozen: string[];
  claimed_milestones: number[];
  /** 오늘탭 출석 날짜('YYYY-MM-DD') — 스트릭 소스(달력 수동보정과 분리). */
  checkins: string[];
  /** 결산 광고 본 달('YYYY-MM') 목록. */
  report_seen: string[];
  /** 표창장 광고 본 달('YYYY-MM') 목록. */
  cert_seen: string[];
}

const ROW_COLUMNS =
  "toss_user_key, fee, target, logs, points, freezes, frozen, claimed_milestones, checkins, report_seen, cert_seen" as const;

let _client: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (_client) return _client;
  const url = process.env.AITS_SUPABASE_URL;
  const serviceKey = process.env.AITS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "AITS_SUPABASE_URL / AITS_SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았어요.",
    );
  }
  _client = createClient(url, serviceKey);
  return _client;
}

// 사용자 row 조회. 없으면 null (신규 유저 — 클라이언트가 첫 저장 시 생성).
export async function fetchRow(tossUserKey: string): Promise<PlnlRow | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(ROW_COLUMNS)
    .eq("toss_user_key", tossUserKey)
    .maybeSingle();
  if (error) throw new Error(`fetchRow failed: ${error.message}`);
  return data as PlnlRow | null;
}
