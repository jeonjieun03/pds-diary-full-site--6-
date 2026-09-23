import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// supabase-js UMD 번들을 index.html에서 먼저 로드하므로 전역 window.supabase 사용
export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
