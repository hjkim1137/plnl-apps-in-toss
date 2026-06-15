// 자체 세션 JWT 발급/검증 — access 1h + refresh 14d 의 두 토큰 흐름.
// 복사 위치: plnl.vercel.app/lib/aits/session.ts
//
// 흐름:
//   /auth/login   → access(1h) + refresh(14d) 둘 다 발급
//   /auth/me /user/* → access 만 사용. 만료 시 401
//   /auth/refresh → refresh 받아 새 access 발급. refresh 자체는 회전 안 함(14d 만료까지 재사용)
//
// 두 토큰은 같은 AITS_SESSION_SECRET 으로 서명하되 payload `typ` 으로 구분.
// 별도 secret 분리도 가능하지만 키 관리 단순화 위해 한 키 + typ 검증.
//
// 의존성: `npm i jose` (Edge runtime 호환)

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = process.env.AITS_SESSION_SECRET ?? "";

const ACCESS_EXPIRES_IN = "1h";
const REFRESH_EXPIRES_IN = "14d";

type TokenType = "access" | "refresh";

function assertConfigured() {
  if (!SECRET || SECRET.length < 32) {
    throw new Error(
      "AITS_SESSION_SECRET 가 비어있거나 32자 미만이에요. `openssl rand -hex 32` 로 생성해 Vercel 환경변수에 등록하세요.",
    );
  }
}

// SECRET 은 모듈 상수라 변하지 않으므로 인코딩 결과를 1회만 만들어 재사용한다.
let _secretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
  assertConfigured();
  return (_secretKey ??= new TextEncoder().encode(SECRET));
}

export interface SessionPayload extends JWTPayload {
  sub: string; // toss userKey (문자열로)
  typ: TokenType;
}

async function signJWT(
  userKey: string,
  typ: TokenType,
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ typ })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userKey)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
}

export function signSession(userKey: string): Promise<string> {
  return signJWT(userKey, "access", ACCESS_EXPIRES_IN);
}

export function signRefreshToken(userKey: string): Promise<string> {
  return signJWT(userKey, "refresh", REFRESH_EXPIRES_IN);
}

async function verifyJWT(
  token: string,
  expected: TokenType,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") return null;
    if (payload.typ !== expected) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function verifySession(token: string): Promise<SessionPayload | null> {
  return verifyJWT(token, "access");
}

export function verifyRefreshToken(
  token: string,
): Promise<SessionPayload | null> {
  return verifyJWT(token, "refresh");
}

// Authorization 헤더에서 Bearer 토큰 추출.
export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/.exec(header);
  return m ? m[1] : null;
}
