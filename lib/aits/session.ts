// 자체 세션 JWT 발급/검증 — access 1h + refresh 14d 의 두 토큰 흐름.
//
// node:crypto 로 HS256 JWT 를 직접 구현한다 (jose 같은 ESM 전용 의존성 X).
//   이유: jose v6 는 ESM 전용이라 Vercel 서버리스 함수 번들이 CJS 로 잡히면
//   require() 단계에서 ERR_REQUIRE_ESM → FUNCTION_INVOCATION_FAILED 로 함수가 죽었다.
//   Node 내장 crypto 는 번들 형식과 무관해 안전(disconnect.ts 와 동일 스타일).
//
// 흐름:
//   /auth/login   → access(1h) + refresh(14d) 둘 다 발급
//   /auth/me      → access 만 사용. 만료 시 401
//   /auth/refresh → refresh 받아 새 access 발급. refresh 자체는 회전 안 함(14d 만료까지 재사용)
//
// 두 토큰은 같은 AITS_SESSION_SECRET 으로 서명하되 payload `typ` 으로 구분.

import crypto from "node:crypto";

const SECRET = process.env.AITS_SESSION_SECRET ?? "";

const ACCESS_EXPIRES_IN_SEC = 60 * 60; // 1h
const REFRESH_EXPIRES_IN_SEC = 14 * 24 * 60 * 60; // 14d

type TokenType = "access" | "refresh";

function assertConfigured() {
  if (!SECRET || SECRET.length < 32) {
    throw new Error(
      "AITS_SESSION_SECRET 가 비어있거나 32자 미만이에요. `openssl rand -hex 32` 로 생성해 Vercel 환경변수에 등록하세요.",
    );
  }
}

export interface SessionPayload {
  sub: string; // toss userKey (문자열로)
  typ: TokenType;
  iat: number; // 발급 시각(초)
  exp: number; // 만료 시각(초)
}

function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function base64urlDecodeToString(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

// HS256 서명.
function hmacSha256(data: string): Buffer {
  return crypto.createHmac("sha256", SECRET).update(data).digest();
}

function signJWT(userKey: string, typ: TokenType, expiresInSec: number): string {
  assertConfigured();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: SessionPayload = {
    sub: userKey,
    typ,
    iat: now,
    exp: now + expiresInSec,
  };
  const headerSeg = base64urlEncode(JSON.stringify(header));
  const payloadSeg = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerSeg}.${payloadSeg}`;
  const sigSeg = base64urlEncode(hmacSha256(signingInput));
  return `${signingInput}.${sigSeg}`;
}

// 원본 호출부가 await 하므로 동일 시그니처 유지 위해 Promise 반환.
export function signSession(userKey: string): Promise<string> {
  return Promise.resolve(signJWT(userKey, "access", ACCESS_EXPIRES_IN_SEC));
}

export function signRefreshToken(userKey: string): Promise<string> {
  return Promise.resolve(signJWT(userKey, "refresh", REFRESH_EXPIRES_IN_SEC));
}

// 상수 시간 비교 — timing attack 방어.
function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyJWT(token: string, expected: TokenType): SessionPayload | null {
  try {
    assertConfigured();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerSeg, payloadSeg, sigSeg] = parts;

    // 1) 서명 검증.
    const expectedSig = hmacSha256(`${headerSeg}.${payloadSeg}`);
    const actualSig = Buffer.from(sigSeg, "base64url");
    if (!safeEqual(actualSig, expectedSig)) return null;

    // 2) 헤더 alg 검증 — HS256 만 허용(alg=none 등 변조 차단).
    const header = JSON.parse(base64urlDecodeToString(headerSeg)) as { alg?: unknown };
    if (header.alg !== "HS256") return null;

    // 3) payload 파싱 + typ/exp 검증.
    const payload = JSON.parse(base64urlDecodeToString(payloadSeg)) as Partial<SessionPayload>;
    if (typeof payload.sub !== "string") return null;
    if (payload.typ !== expected) return null;
    if (typeof payload.exp !== "number") return null;
    const now = Math.floor(Date.now() / 1000);
    if (now >= payload.exp) return null;

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function verifySession(token: string): Promise<SessionPayload | null> {
  return Promise.resolve(verifyJWT(token, "access"));
}

export function verifyRefreshToken(token: string): Promise<SessionPayload | null> {
  return Promise.resolve(verifyJWT(token, "refresh"));
}

// Authorization 헤더에서 Bearer 토큰 추출. req.headers.authorization(string|string[]|undefined)을
// 그대로 받아 내부에서 narrowing 한다 — 호출부의 typeof 분기 중복 제거.
export function extractBearer(header: string | string[] | undefined): string | null {
  const h = typeof header === "string" ? header : null;
  if (!h) return null;
  const m = /^Bearer\s+(\S+)$/.exec(h);
  return m ? m[1] : null;
}
