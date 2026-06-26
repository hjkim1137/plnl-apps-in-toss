// 토스 연결 끊기 콜백 — Vercel 서버리스 함수 (plnl-apps-in-toss 레포에 co-locate).
//   URL: https://<plnl-vercel-도메인>/api/aits/auth/disconnect  (메서드 POST, Basic Auth)
//
// 배포 구조: 미니앱(src/)은 `ait deploy` 로 토스 CDN 에, 이 /api 함수만 Vercel 에 배포된다
//   (vercel.json 참고 — 프론트 빌드는 Vercel 에서 건너뛰고 /api 함수만 빌드/호스팅).
// sajumon(sajumon.vercel.app)의 동일 라우트와 같은 방식:
//   Basic Auth 검증 → userKey 추출 → Supabase service-role 로 row 삭제 → 200.
//
// CORS: 토스 콘솔 "테스트하기"는 브라우저 fetch 라 preflight OPTIONS 발생 → `*.toss.im` 허용.
//   실제 production(토스 서버 → 우리 서버)은 server-to-server 라 CORS 무관.

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// plnl 미니앱 사용자 row 테이블 (src/lib/userData.ts 의 TABLE 과 동일).
const TABLE = "plnl_aits_users";
const TOSS_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*toss\.im$/;

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (TOSS_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// 상수 시간 비교 — timing attack 방어.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyBasicAuth(req: VercelRequest): boolean {
  const header =
    typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!header.startsWith("Basic ")) return false;
  const expectedUser = process.env.AITS_DISCONNECT_BASIC_USER ?? "";
  const expectedPass = process.env.AITS_DISCONNECT_BASIC_PASS ?? "";
  if (!expectedUser || !expectedPass) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    return (
      safeEqual(decoded.slice(0, idx), expectedUser) &&
      safeEqual(decoded.slice(idx + 1), expectedPass)
    );
  } catch {
    return false;
  }
}

function extractUserKey(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const raw = b.userKey ?? b.user_key ?? b.tossUserKey;
  if (typeof raw === "string" && raw.length > 0) return raw;
  // 토스는 userKey 를 number 로 보낸다. 0(테스트 dummy)·음수·NaN 제외, 양수만 유효.
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(raw);
  return null;
}

function parseBody(req: VercelRequest): unknown {
  const body: unknown = req.body;
  if (body == null) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf-8"));
    } catch {
      return {};
    }
  }
  return body; // Vercel 이 application/json 을 이미 객체로 파싱한 경우
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  // 1) Basic Auth 검증 — 실패 시 401.
  if (!verifyBasicAuth(req)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="aits-disconnect"');
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // 2) userKey 추출. 토스 형식: { userKey: <number>, referrer: 'UNLINK' }.
  //    콘솔 "테스트하기"는 dummy userKey:0 → 식별자 없음으로 200 ack.
  const userKey = extractUserKey(parseBody(req));
  if (!userKey) {
    res.status(200).json({ ok: true, deleted: 0 });
    return;
  }

  // 3) Supabase service-role 로 toss_user_key 기준 row 삭제.
  const supabaseUrl = process.env.AITS_SUPABASE_URL;
  const serviceKey = process.env.AITS_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // 실제 userKey 가 왔는데 삭제 불가한 오설정 → 500 으로 명확히 노출.
    // (콘솔 "테스트하기"는 위에서 이미 200 통과하므로 검수에는 영향 없음.)
    console.error("[aits/disconnect] Supabase env 미설정 — 삭제 불가", { userKey });
    res.status(500).json({ error: "supabase_not_configured" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error, count } = await supabase
    .from(TABLE)
    .delete({ count: "exact" })
    .eq("toss_user_key", userKey);

  if (error) {
    console.error("[aits/disconnect] supabase delete failed", { userKey, error });
    // 5xx 반환 → 토스가 재시도하도록 함.
    res.status(500).json({ error: "delete_failed" });
    return;
  }

  res.status(200).json({ ok: true, deleted: count ?? 0 });
}
