// HTTP 헬퍼 (Vercel @vercel/node 핸들러 공용) — 요청 본문 파싱 + CORS + preflight/메서드 가드.
// login/refresh/me 가 공유한다. (disconnect.ts 는 콘솔(*.toss.im) 전용 CORS 라 자체 헬퍼 유지.)

import type { VercelRequest, VercelResponse } from "@vercel/node";

// 요청 본문 파싱 — Vercel 이 application/json 을 객체로 줄 때도, 문자열/Buffer 일 때도 흡수.
export function parseBody(req: VercelRequest): unknown {
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
  return body; // Vercel 이 이미 객체로 파싱한 경우
}

// 미니앱(`*.apps.tossmini.com`) origin 화이트리스트 — AITS_ALLOWED_ORIGINS(`,` 구분, `*` 와일드카드).
// 패턴은 배포 동안 불변이므로 모듈 스코프에서 1회만 파싱/정규식 컴파일해 재사용.
let _matchers: { exact: Set<string>; regexes: RegExp[] } | null = null;
function getMatchers() {
  if (_matchers) return _matchers;
  const exact = new Set<string>();
  const regexes: RegExp[] = [];
  for (const raw of (process.env.AITS_ALLOWED_ORIGINS ?? "").split(",")) {
    const p = raw.trim();
    if (!p) continue;
    if (p.includes("*")) {
      regexes.push(new RegExp("^" + p.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"));
    } else {
      exact.add(p);
    }
  }
  return (_matchers = { exact, regexes });
}

function isAllowedByEnv(origin: string): boolean {
  if (!origin) return false;
  const m = getMatchers();
  return m.exact.has(origin) || m.regexes.some((re) => re.test(origin));
}

// 검증된 origin 만 반향(echo). 헤더 형태(Allow-Headers/Max-Age 등)는 여기서 일괄 관리.
export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  opts: { methods?: string } = {},
): void {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  if (isAllowedByEnv(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", opts.methods ?? "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// CORS 적용 + OPTIONS(204) + 메서드 가드를 한 번에. 처리됐으면 true → 호출부는 즉시 return.
// Allow-Methods 를 method 인자에서 파생해 405 검사와 절대 어긋나지 않게 한다.
export function preflight(
  req: VercelRequest,
  res: VercelResponse,
  method: "GET" | "POST",
): boolean {
  applyCors(req, res, { methods: `${method}, OPTIONS` });
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  if (req.method !== method) {
    res.status(405).json({ error: "method_not_allowed" });
    return true;
  }
  return false;
}
