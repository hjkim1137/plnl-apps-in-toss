// 토스 연결 끊기 콜백 — 사용자가 토스 설정에서 뺄래 낼래 연결 해제 시 토스가 호출.
// 토스 콘솔에 등록 시: 메서드 POST, Basic Auth 사용.
// 복사 위치: plnl.vercel.app/app/api/aits/auth/disconnect/route.ts
//
// CORS:
//   토스 콘솔의 "테스트하기" 는 브라우저 fetch 로 호출 → preflight OPTIONS 발생.
//   이 라우트만 `*.toss.im` origin 을 허용한다 (다른 /api/aits/* 라우트는 미니앱
//   `*.apps.tossmini.com` 만 허용 — disconnect 는 콘솔에서도 호출되므로 별도 정책).
//   실제 production 호출(토스 서버 → 우리 서버)은 server-to-server 라 CORS 무관.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  limiters,
  rateLimitByIp,
  tooManyRequests,
} from "@/lib/aits/ratelimit";
import { corsHeaders as dbCorsHeaders, getSupabase, TABLE } from "@/lib/aits/db";

// 외부 webhook 이라 Node runtime 사용 (timingSafeEqual 등 활용 가능).
export const runtime = "nodejs";

// 이 라우트만 콘솔(`*.toss.im`) origin 을 허용 — 미니앱 origin 은 안 받는다.
// 헤더 형태는 db.ts 의 공유 헬퍼에서 관리하고 정책(matcher/methods)만 주입한다.
const TOSS_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*toss\.im$/;
function corsHeaders(req: NextRequest): HeadersInit {
  return dbCorsHeaders(req, {
    matchOrigin: (origin) => TOSS_ORIGIN.test(origin),
    methods: "POST, OPTIONS",
  });
}

function extractUserKey(body: Record<string, unknown>): string | null {
  const raw = body.userKey ?? body.user_key ?? body.tossUserKey;
  if (typeof raw === "string" && raw.length > 0) return raw;
  // 토스는 userKey 를 number 로 보낸다. 0(테스트 dummy)·음수·NaN 제외, 양수만 유효.
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return String(raw);
  }
  return null;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// 상수 시간 비교 — timing attack 방어 (Node stdlib).
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyBasicAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const expectedUser = process.env.AITS_DISCONNECT_BASIC_USER ?? "";
  const expectedPass = process.env.AITS_DISCONNECT_BASIC_PASS ?? "";
  if (!expectedUser || !expectedPass) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    return safeEqual(user, expectedUser) && safeEqual(pass, expectedPass);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);

  // 0) IP rate limit — Basic Auth secret 노출 시 userKey enumerate 폭주 차단.
  //    정상 토스 webhook 은 단일 IP 에서 100/60s 절대 도달 안 함.
  const rl = await rateLimitByIp(limiters().authDisconnect, req);
  if (!rl.ok) return tooManyRequests(rl.retryAfterMs, cors);

  // 1) Basic Auth 검증 — 실패 시 401 + WWW-Authenticate 헤더.
  if (!verifyBasicAuth(req)) {
    return NextResponse.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: { ...cors, "WWW-Authenticate": 'Basic realm="aits-disconnect"' },
      },
    );
  }

  // 2) 페이로드 파싱.
  //    토스가 실제로 보내는 형식: { userKey: <number>, referrer: 'UNLINK' }
  //    - userKey 는 number 타입 (DB 에는 String 으로 저장하므로 변환 필요)
  //    - 콘솔 "테스트하기" 는 dummy 로 userKey: 0 을 보내므로 양수만 유효 처리.
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // body 없거나 JSON 아니어도 진행.
  }

  const userKey = extractUserKey(body);

  if (!userKey) {
    // 식별자 없으면 200 으로 회신 (테스트 dummy 흡수).
    return NextResponse.json({ ok: true, deleted: 0 }, { headers: cors });
  }

  // 3) Supabase row 삭제 — toss_user_key 기준. db.ts 공유 클라이언트 사용.
  const { error, count } = await getSupabase()
    .from(TABLE)
    .delete({ count: "exact" })
    .eq("toss_user_key", userKey);

  if (error) {
    console.error("[aits/disconnect] supabase delete failed", { userKey, error });
    // 5xx 반환 → 토스가 재시도하도록 함.
    return NextResponse.json(
      { error: "delete_failed" },
      { status: 500, headers: cors },
    );
  }

  return NextResponse.json(
    { ok: true, deleted: count ?? 0 },
    { headers: cors },
  );
}
