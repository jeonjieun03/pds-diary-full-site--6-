import { db } from "./supabaseClient.js";

// ---------- 가입 / 로그인 / 로그아웃 ----------
// Supabase Auth(이메일+비밀번호)를 그대로 사용한다.
// 비밀번호는 한 번도 우리 코드나 우리 표를 거치지 않고, 곧바로 Supabase의
// GoTrue 인증 서버로 전송되어 그쪽에서 해시(bcrypt)로 저장된다.

export async function signUp(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(cb) {
  const { data: sub } = db.auth.onAuthStateChange((_event, session) => cb(session));
  return sub;
}

// ---------- 계정 삭제 ----------
// 클라이언트(anon key)만으로는 Supabase Auth의 "계정 자체"를 지울 권한이 없다
// (그건 service_role 키가 있는 서버에서만 가능하고, service_role 키는 절대
// 브라우저 코드에 넣으면 안 된다 — 카드 3 참고).
// 그래서 여기서는 "내 자료를 전부 지운다"까지를 클라이언트가 직접 수행하고,
// 화면에는 "계정 자체는 곧이어 로그아웃되며, 인증 정보 삭제는 관리자 절차로
// 별도 처리된다"는 안내를 함께 보여준다. (완주 체크리스트의
// "지워진다는 안내가 화면에 적혀 있다" 쪽을 택함)
export async function deleteMyData() {
  const tables = ["executions", "plan_revisions", "todos", "review_notes", "plans"];
  for (const t of tables) {
    const { error } = await db.from(t).delete().not("id", "is", null);
    if (error) throw error;
  }
}
