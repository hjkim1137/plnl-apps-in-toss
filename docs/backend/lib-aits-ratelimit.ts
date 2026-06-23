// Upstash Redis 기반 rate limit — IP 또는 userKey 단위로 라우트별 임계치 적용.
// 복사 위치: plnl.vercel.app/lib/aits/ratelimit.ts
//
// 의존성: `@upstash/ratelimit`, `@upstash/redis`
// 환경변수: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
//
// 정책 — 각 라우트의 rate limit (모두 sliding window):
//   /auth/login           IP        10 req / 60s   봇 로그인 폭주 방지
//   /auth/refresh         IP        10 req / 60s   (authLogin 재사용)
//   /auth/me              userKey   60 req / 60s   세션 검증 — 정상 사용 충분
//   /auth/disconnect      IP       100 req / 60s   Basic Auth secret 노출 시 enumerate 차단
//   /user/checkin         userKey   60 req / 60s   출석 체크
//   /user/claim-milestone userKey   10 req / 60s   광고 시청 보상 — 분당 상한
//   /user/buy-freeze      userKey   20 req / 60s   보호권 구매/광고 획득
//   /user/resolve-repair  userKey   20 req / 60s   보호권 복구 제안 수락/거절
//   /user/settings        userKey   10 req / 60s   설정 변경(드묾)

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 가 설정되지 않았어요.",
    );
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

function makeLimiter(opts: {
  prefix: string;
  limit: number;
  windowSeconds: number;
}): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowSeconds} s`),
    prefix: opts.prefix,
    analytics: false,
  });
}

// lazy singleton — 첫 import 시 Redis 미설정이어도 throw 안 함.
let _limiters: Record<string, Ratelimit> | null = null;
export function limiters() {
  if (_limiters) return _limiters;
  _limiters = {
    authLogin: makeLimiter({ prefix: "rl:authLogin", limit: 10, windowSeconds: 60 }),
    authMe: makeLimiter({ prefix: "rl:authMe", limit: 60, windowSeconds: 60 }),
    authDisconnect: makeLimiter({ prefix: "rl:authDisconnect", limit: 100, windowSeconds: 60 }),
    userCheckin: makeLimiter({ prefix: "rl:userCheckin", limit: 60, windowSeconds: 60 }),
    userClaimMilestone: makeLimiter({ prefix: "rl:userClaimMilestone", limit: 10, windowSeconds: 60 }),
    userBuyFreeze: makeLimiter({ prefix: "rl:userBuyFreeze", limit: 20, windowSeconds: 60 }),
    userResolveRepair: makeLimiter({ prefix: "rl:userResolveRepair", limit: 20, windowSeconds: 60 }),
    userSettings: makeLimiter({ prefix: "rl:userSettings", limit: 10, windowSeconds: 60 }),
  };
  return _limiters;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

async function applyLimit(
  limiter: Ratelimit,
  key: string,
): Promise<RateLimitResult> {
  const { success, reset } = await limiter.limit(key);
  if (success) return { ok: true };
  return { ok: false, retryAfterMs: Math.max(0, reset - Date.now()) };
}

// userKey 기반 — 세션 검증 후 호출. 동일 사용자의 봇팅·연타 abuse 방어.
export function rateLimitByUserKey(
  limiter: Ratelimit,
  userKey: string,
): Promise<RateLimitResult> {
  return applyLimit(limiter, `u:${userKey}`);
}

// IP 기반 — 인증 전 라우트(/auth/login, /auth/refresh, /auth/disconnect)용.
export function rateLimitByIp(
  limiter: Ratelimit,
  req: Request,
): Promise<RateLimitResult> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return applyLimit(limiter, `ip:${ip}`);
}

// 429 응답 헬퍼. CORS 헤더 합쳐서 반환.
export function tooManyRequests(
  retryAfterMs: number,
  cors: HeadersInit,
): Response {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(
    JSON.stringify({ error: "rate_limited", retryAfter: retryAfterSec }),
    {
      status: 429,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}
