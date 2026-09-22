import { db } from "./supabaseClient.js";

// ---------- 조회 ----------
export async function fetchAllData() {
  const [plansRes, todosRes, execRes, revRes, notesRes] = await Promise.all([
    db.from("plans").select("*").order("created_at", { ascending: true }),
    db.from("todos").select("*").order("created_at", { ascending: true }),
    db.from("executions").select("*").order("started_at", { ascending: true }),
    db.from("plan_revisions").select("*").order("revised_at", { ascending: true }),
    db.from("review_notes").select("*").order("created_at", { ascending: true }),
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
  const { data, error } = await db.from("plans").insert(plan).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlan(planId, changes, currentRow) {
  // 고치기 전 값을 먼저 이력 표에 스냅샷으로 남긴다.
  const { error: revErr } = await db.from("plan_revisions").insert({
    plan_id: planId,
    snapshot: currentRow,
  });
  if (revErr) throw revErr;

  const { data, error } = await db
    .from("plans")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPlanRevisions(planId) {
  const { data, error } = await db
    .from("plan_revisions")
    .select("*")
    .eq("plan_id", planId)
    .order("revised_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ---------- 할 일 ----------
export async function createTodo(todo) {
  const { data, error } = await db.from("todos").insert(todo).select().single();
  if (error) throw error;
  return data;
}

export async function updateTodo(todoId, changes) {
  const { data, error } = await db
    .from("todos")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", todoId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTodo(todoId) {
  const { error } = await db.from("todos").delete().eq("id", todoId);
  if (error) throw error;
}

// 완료 처리: status가 아직 done이 아닐 때만 원자적으로 done으로 바꾸고,
// 그때에만 실행 기록을 1건 추가한다. 연달아 두 번 눌러도 두 번째 호출은 0행을 반환하므로
// 실행 기록도, 완료 집계도 중복으로 늘어나지 않는다.
export async function completeTodoWithExecution(todoId, execution) {
  const { data: updated, error: updErr } = await db
    .from("todos")
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
    .from("executions")
    .insert({ todo_id: todoId, ...execution })
    .select()
    .single();
  if (execErr) throw execErr;

  return { alreadyDone: false, todo: updated, execution: execRow };
}

export async function uncompleteTodo(todoId) {
  // 실행 기록은 그대로 두고(이력 보존), 상태만 되돌린다.
  const { data, error } = await db
    .from("todos")
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
    .from("executions")
    .insert({ todo_id: todoId, ...execution })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- 돌아보기 ----------
export async function addReviewNote(note) {
  const { data, error } = await db.from("review_notes").insert({ note }).select().single();
  if (error) throw error;
  return data;
}

export async function markNoteCarried(noteId, planId) {
  const { error } = await db.from("review_notes").update({ carried_to_plan_id: planId }).eq("id", noteId);
  if (error) throw error;
}
