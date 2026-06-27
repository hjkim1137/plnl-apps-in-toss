// 토스 mTLS API 호출 헬퍼 — Vercel 서버리스 함수용(co-located).
// 원본: docs/backend/lib-aits-tossApi.ts (Next.js 레포 reference).
//
// Vercel/Node 의 글로벌 fetch 는 mTLS client cert 옵션을 노출하지 않아 node:https 를 직접 쓴다.
// 이 lib 를 쓰는 함수는 Node runtime 에서 동작해야 한다(@vercel/node 함수는 기본 Node runtime).

import https from "node:https";

const CLIENT_CERT = process.env.TOSS_AITS_CLIENT_CERT ?? "";
const CLIENT_KEY = process.env.TOSS_AITS_CLIENT_KEY ?? "";
const BASE_URL = process.env.TOSS_AITS_BASE_URL ?? "https://apps-in-toss-api.toss.im";

function assertConfigured() {
  if (!CLIENT_CERT || !CLIENT_KEY) {
    throw new Error(
      "TOSS_AITS_CLIENT_CERT / TOSS_AITS_CLIENT_KEY 환경변수가 설정되지 않았어요. 사업자 등록 통과 후 콘솔에서 발급받아 Vercel 환경변수에 등록하세요.",
    );
  }
}

type TossResult<T> =
  | { resultType: "SUCCESS"; success: T }
  | { resultType: "FAIL"; error: { errorCode: string; reason: string } };

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function tossFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<TossResult<T>> {
  assertConfigured();
  const { method = "POST", body, headers = {} } = options;
  const url = new URL(path, BASE_URL);

  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        cert: CLIENT_CERT,
        key: CLIENT_KEY,
        headers: {
          "Content-Type": "application/json",
          ...headers,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          try {
            const parsed = JSON.parse(raw) as TossResult<T>;
            resolve(parsed);
          } catch {
            reject(new Error(`Toss API parse error: ${raw}`));
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── 토스 OAuth2 토큰 발급 ──────────────────────────────────────────────
export interface GenerateTokenSuccess {
  tokenType: "Bearer";
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}
export function tossGenerateToken(authorizationCode: string, referrer: string) {
  return tossFetch<GenerateTokenSuccess>(
    "/api-partner/v1/apps-in-toss/user/oauth2/generate-token",
    { body: { authorizationCode, referrer } },
  );
}

// ─── 사용자 정보 조회 ───────────────────────────────────────────────────
export interface LoginMeSuccess {
  userKey: number;
  scope: string;
  agreedTerms: string[];
  name: string | null; // 암호화 — pii.decryptPII 로 복호화
  phone: string | null; // 암호화
  birthday: string | null; // 암호화 (yyyyMMdd)
  ci: string | null; // 암호화
  di: null; // 항상 null
  gender: string | null; // 암호화
  nationality: string | null; // 암호화
  email: string | null; // 암호화
}
export function tossLoginMe(accessToken: string) {
  return tossFetch<LoginMeSuccess>("/api-partner/v1/apps-in-toss/user/oauth2/login-me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
