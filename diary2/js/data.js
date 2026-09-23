import { db } from "./supabaseClient.js";

// ---------- 조회 ----------
export async function fetchAllData() {
  const [plansRes, todosRes, execRes, revRes, notesRes] = await Promise.all([
    db.from("plans_t07").select("*").order("created_at", { ascending: true }),
    db.from("todos_t07").select("*").order("created_at", { ascending: true }),
    db.from("executions_t07").select("*").order("started_at", { ascending: true }),
    db.from("plan_revisions_t07").select("*").order("revised_at", { ascending: true }),
    db.from("review_notes_t07").select("*").order("created_at", { ascending: true }),
  ]);
  for (const r of [plansRes, todosRes, execRes, revRes, notesRes]) {
    if (r.error) throw r.error;
  }
  return {
    plans: plansRes.data,
    todos: todosRes.data,
    executions: execRes.data,
    revisions: revRes.data,
    reviewNotes: notesRes.data,
  };
}

// ---------- 계획 ----------
export async function createPlan(plan) {
  const { data, error } = await db.from("plans_t07").insert(plan).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlan(planId, changes, currentRow) {
  // 고치기 전 값을 먼저 이력 표에 스냅샷으로 남긴다.
  const { error: revErr } = await db.from("plan_revisions_t07").insert({
    plan_id: planId,
    snapshot: currentRow,
  });
  if (revErr) throw revErr;

  // 주인이 아니면 403을 명시적으로 내는 서버 함수를 거친다(update_plan_secure).
  const { data, error } = await db.rpc("update_plan_secure", { p_plan_id: planId, p_patch: changes });
  if (error) throw error;
  return data;
}

export async function fetchPlanRevisions(planId) {
  const { data, error } = await db
    .from("plan_revisions_t07")
    .select("*")
    .eq("plan_id", planId)
    .order("revised_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ---------- 할 일 ----------
export async function createTodo(todo) {
  const { data, error } = await db.from("todos_t07").insert(todo).select().single();
  if (error) throw error;
  return data;
}

// 과제 7부터: 직접 update/delete 대신, "주인이 아니면 403을 명시적으로 낸다"는
// 서버 함수(update_todo_secure/delete_todo_secure, sql/schema-t07.sql)를 거친다.
// RLS만으로도 남의 행은 0건 처리되어 결과적으로는 막히지만, 이 함수들을 쓰면
// "막혔다"는 사실이 403이라는 분명한 상태 코드로 드러난다(카드 4 참고).
export async function updateTodo(todoId, changes) {
  const { data, error } = await db.rpc("update_todo_secure", { p_todo_id: todoId, p_patch: changes });
  if (error) throw error;
  return data;
}

export async function deleteTodo(todoId) {
  const { error } = await db.rpc("delete_todo_secure", { p_todo_id: todoId });
  if (error) throw error;
}

// 완료 처리: status가 아직 done이 아닐 때만 원자적으로 done으로 바꾸고,
// 그때에만 실행 기록을 1건 추가한다. 연달아 두 번 눌러도 두 번째 호출은 0행을 반환하므로
// 실행 기록도, 완료 집계도 중복으로 늘어나지 않는다.
export async function completeTodoWithExecution(todoId, execution) {
  const { data: updated, error: updErr } = await db
    .from("todos_t07")
    .update({ status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", todoId)
    .eq("status", "in_progress")
    .select()
    .single();

  if (updErr && updErr.code !== "PGRST116") throw updErr; // PGRST116: 0행(이미 완료) — 정상적인 idempotent 상황
  if (!updated) {
    return { alreadyDone: true };
  }

  const { data: execRow, error: execErr } = await db
    .from("executions_t07")
    .insert({ todo_id: todoId, ...execution })
    .select()
    .single();
  if (execErr) throw execErr;

  return { alreadyDone: false, todo: updated, execution: execRow };
}

export async function uncompleteTodo(todoId) {
  // 실행 기록은 그대로 두고(이력 보존), 상태만 되돌린다.
  const { data, error } = await db
    .from("todos_t07")
    .update({ status: "in_progress", completed_at: null, updated_at: new Date().toISOString() })
    .eq("id", todoId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// 완료와 무관하게 실행 기록만 남기고 싶을 때(예: 막혔지만 아직 완료는 아님)
export async function addStandaloneExecution(todoId, execution) {
  const { data, error } = await db
    .from("executions_t07")
    .insert({ todo_id: todoId, ...execution })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- 돌아보기 ----------
export async function addReviewNote(note) {
  const { data, error } = await db.from("review_notes_t07").insert({ note }).select().single();
  if (error) throw error;
  return data;
}

export async function markNoteCarried(noteId, planId) {
  const { error } = await db.from("review_notes_t07").update({ carried_to_plan_id: planId }).eq("id", noteId);
  if (error) throw error;
}
