// Supabase 프로젝트 설정
// 1. https://supabase.com 에서 무료 프로젝트를 만듭니다.
// 2. Project Settings → API 에서 "Project URL"과 "anon public" 키를 복사해 아래에 붙여넣습니다.
//    ⚠️ "service_role" 키는 절대 여기에 넣지 마세요. 그건 진짜 비밀키입니다.
//    "anon public" 키는 클라이언트에 공개되도록 설계된 키라 노출돼도 안전합니다.
//    (실제 접근 제어는 RLS 정책이 하고, 이번 과제는 로그인이 없으므로 읽기/쓰기를 모두 열어 둔 상태입니다.)
// 3. SQL Editor에서 sql/schema.sql 내용을 그대로 실행합니다.

export const SUPABASE_URL = "https://kphstwymzmddwruvbgvv.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwaHN0d3ltem1kZHdydXZiZ3Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NTYxNjYsImV4cCI6MjEwNTIzMjE2Nn0.yAJF9WbIm3Vjf1vsz4UUVwut7mYdUN3D0uNan8qXFWs";
