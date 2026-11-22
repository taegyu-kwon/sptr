/* Supabase 클라이언트 — 서버 모드(이메일 로그인)에서만 쓴다. 체험 모드는 서버를 건드리지 않는다. */
import { createClient } from "@supabase/supabase-js";

// 공개용(publishable) 키라 코드에 넣어도 된다. 다른 프로젝트로 바꾸려면 VITE_SUPABASE_URL / VITE_SUPABASE_KEY 로 덮어쓴다.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://cmhofizbmefoduljvklh.supabase.co";
export const SUPABASE_KEY = env.VITE_SUPABASE_KEY || "sb_publishable_FCI3IiqN5Xnbjqpo5rAH8A_14FP31mw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true, // 새로고침해도 로그인 유지(브라우저 저장소에는 로그인 토큰만 남는다)
    autoRefreshToken: true,
    detectSessionInUrl: false, // HashRouter 라 주소의 # 뒤를 로그인 토큰으로 읽지 않게 한다
  },
});
