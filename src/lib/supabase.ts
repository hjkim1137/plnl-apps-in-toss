import { createClient } from "@supabase/supabase-js";

// VITE_* env 변수는 클라이언트 번들에 노출됨. anon key만 두고 service role key는 절대 두지 않는다.
// 실제 권한 통제는 Supabase RLS 정책으로 해결한다. (sajumon 패턴 이식)

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았어요. .env.local 또는 배포 환경변수를 확인하세요.",
  );
}

// env 없는 dev 환경에서 createClient("")가 throw하는 것을 막기 위해 placeholder 사용.
// 실제 DB 호출은 isAuthConfigured() / API_BASE 체크로 이미 차단됨.
const safeUrl = url || "https://placeholder.supabase.co";
const safeKey = anonKey || "placeholder-anon-key";

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
