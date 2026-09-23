import * as api from "./data.js";
import { todayKST, isOverdueKST, formatDateTimeKST, nowLocalInputValue, minutesBetween, uid, el } from "./utils.js";

const state = {
  plans: [],
  todos: [],
  executions: [],
  revisions: [],
  reviewNotes: [],
  activeTab: "plans",
  todoFilter: { search: "", status: "all", priority: "all", tag: "", planId: "all" },
  todoSort: "created_desc",
  highlight: null, // { planId, kind } for drill-down from 돌아보기
  reviewMonth: todayKST().slice(0, 7), // "YYYY-MM" — 돌아보기 달력이 보여주는 달
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// 저장 버튼을 빠르게 두 번 눌러도 같은 내용이 두 번 저장되지 않도록,
// 요청이 끝날 때까지 제출 버튼을 잠깐 비활성화한다.
function guardSubmit(form, handler) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    if (btn && btn.disabled) return; // 이미 처리 중이면 무시
    if (btn) btn.disabled = true;
    try {
      await handler(e);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

async function loadAll() {
  const data = await api.fetchAllData();
  Object.assign(state, data);
  renderAll();
}

function renderAll() {
  renderTabs();
  renderPlans();
  renderTodoPlanOptions();
  renderTodos();
  renderExecFormOptions();
  renderExecutionLog();
  renderReview();
}

// ---------------- 탭 ----------------
function renderTabs() {
  $$(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === state.activeTab);
  });
  $$(".tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== state.activeTab;
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  renderTabs();
}

$$(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

// ---------------- 계획 ----------------
function planTodos(planId) {
  return state.todos.filter((t) => t.plan_id === planId);
}

function renderPlans() {
  const list = $("#plan-list");
  list.textContent = "";
  if (state.plans.length === 0) {
    list.appendChild(el("p", "empty-note", "아직 계획이 없습니다. 지금 실제로 하고 있는 일 하나를 아래에 적어보세요."));
    return;
  }
  for (const plan of state.plans) {
    const card = el("article", "plan-card");
    card.dataset.planId = plan.id;

    const head = el("div", "plan-card__head");
    head.appendChild(el("h3", null, plan.title));
    head.appendChild(el("span", `badge badge--${plan.priority}`, `우선순위 ${plan.priority}`));
    card.appendChild(head);

    const meta = el("p", "plan-card__meta", `${plan.period_start} ~ ${plan.period_end} · 예상 ${plan.estimated_minutes}분`);
    card.appendChild(meta);

    const crit = el("p", "plan-card__crit", `성공 기준: ${plan.success_criteria}`);
    card.appendChild(crit);

    if (plan.note) {
      card.appendChild(el("p", "plan-card__note", `메모: ${plan.note}`));
    }

    const todoCount = planTodos(plan.id).length;
    card.appendChild(el("p", "plan-card__count", `딸린 할 일 ${todoCount}개`));

    const actions = el("div", "plan-card__actions");
    const editBtn = el("button", "btn btn--ghost", "계획 고치기");
    editBtn.addEventListener("click", () => openPlanEditForm(plan));
    const histBtn = el("button", "btn btn--ghost", "수정 이력 보기");
    histBtn.addEventListener("click", () => showPlanHistory(plan));
    const focusTodoBtn = el("button", "btn btn--ghost", "이 계획의 할 일 보기");
    focusTodoBtn.addEventListener("click", () => {
      state.todoFilter.planId = plan.id;
      state.activeTab = "todos";
      renderAll();
      $("#todo-panel-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    actions.append(editBtn, histBtn, focusTodoBtn);
    card.appendChild(actions);

    list.appendChild(card);
  }
}

function fillPlanForm(form, plan) {
  form.title.value = plan?.title ?? "";
  form.period_start.value = plan?.period_start ?? todayKST();
  form.period_end.value = plan?.period_end ?? todayKST();
  form.priority.value = plan?.priority ?? "중";
  form.success_criteria.value = plan?.success_criteria ?? "";
  form.estimated_minutes.value = plan?.estimated_minutes ?? 60;
  form.note.value = plan?.note ?? "";
}

let editingPlanId = null;

function openPlanEditForm(plan) {
  editingPlanId = plan.id;
  const form = $("#plan-form");
  fillPlanForm(form, plan);
  $("#plan-form-title").textContent = "계획 고치기";
  $("#plan-form-submit").textContent = "고친 내용 저장";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetPlanForm() {
  editingPlanId = null;
  const form = $("#plan-form");
  fillPlanForm(form, null);
  $("#plan-form-title").textContent = "새 계획 세우기";
  $("#plan-form-submit").textContent = "계획 저장";
}

async function showPlanHistory(plan) {
  const revisions = await api.fetchPlanRevisions(plan.id);
  const box = $("#plan-history-box");
  box.textContent = "";
  box.hidden = false;
  box.appendChild(el("h4", null, `"${plan.title}" 수정 이력`));
  if (revisions.length === 0) {
    box.appendChild(el("p", "empty-note", "아직 고친 적이 없습니다. 지금 값이 처음 계획 그대로입니다."));
  } else {
    for (const rev of revisions) {
      const s = rev.snapshot;
      const item = el("div", "history-item");
      item.appendChild(el("p", "history-item__time", `${formatDateTimeKST(rev.revised_at)} 이전 값`));
      item.appendChild(
        el(
          "p",
          null,
          `제목: ${s.title} / 기간: ${s.period_start}~${s.period_end} / 우선순위: ${s.priority} / 예상: ${s.estimated_minutes}분`
        )
      );
      item.appendChild(el("p", null, `성공 기준: ${s.success_criteria}`));
      box.appendChild(item);
    }
  }
  const closeBtn = el("button", "btn btn--ghost", "닫기");
  closeBtn.addEventListener("click", () => (box.hidden = true));
  box.appendChild(closeBtn);
}

guardSubmit($("#plan-form"), async (e) => {
  const f = e.target;
  const payload = {
    title: f.title.value.trim(),
    period_start: f.period_start.value,
    period_end: f.period_end.value,
    priority: f.priority.value,
    success_criteria: f.success_criteria.value.trim(),
    estimated_minutes: Number(f.estimated_minutes.value) || 0,
    note: f.note.value.trim(),
  };
  if (!payload.title || !payload.success_criteria) return;

  if (editingPlanId) {
    const current = state.plans.find((p) => p.id === editingPlanId);
    await api.updatePlan(editingPlanId, payload, current);
  } else {
    const created = await api.createPlan(payload);
    // 방금 반영한 회고 메모가 있으면 연결 표시
    if (state.pendingCarryNoteId) {
      await api.markNoteCarried(state.pendingCarryNoteId, created.id);
      state.pendingCarryNoteId = null;
    }
  }
  resetPlanForm();
  await loadAll();
});

$("#plan-form-reset").addEventListener("click", () => resetPlanForm());

// ---------------- 할 일 ----------------
function renderTodoPlanOptions() {
  const selectors = [$("#todo-form-plan"), $("#todo-filter-plan")];
  for (const sel of selectors) {
    const keep = sel.value;
    sel.textContent = "";
    if (sel.id === "todo-filter-plan") {
      sel.appendChild(new Option("모든 계획", "all"));
    }
    for (const plan of state.plans) {
      sel.appendChild(new Option(plan.title, plan.id));
    }
    if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
  }
  if (state.todoFilter.planId !== "all" && $("#todo-filter-plan")) {
    $("#todo-filter-plan").value = state.todoFilter.planId;
  }
}

function todoBlockedReasons(todoId) {
  return state.executions.filter((e) => e.todo_id === todoId && e.blocked_reason && e.blocked_reason.trim() !== "");
}

function todoActualMinutes(todoId) {
  return state.executions.filter((e) => e.todo_id === todoId).reduce((sum, e) => sum + Number(e.actual_minutes), 0);
}

function filteredSortedTodos() {
  const f = state.todoFilter;
  let list = state.todos.slice();
  if (f.planId !== "all") list = list.filter((t) => t.plan_id === f.planId);
  if (f.status !== "all") list = list.filter((t) => t.status === f.status);
  if (f.priority !== "all") list = list.filter((t) => t.priority === f.priority);
  if (f.tag.trim()) list = list.filter((t) => (t.tags || []).includes(f.tag.trim()));
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.tags || []).some((tag) => tag.toLowerCase().includes(q)));
  }
  if (state.highlight?.kind === "blocked") {
    list = list.filter((t) => todoBlockedReasons(t.id).length > 0);
  } else if (state.highlight?.kind === "overdue") {
    list = list.filter((t) => t.status !== "done" && isOverdueKST(t.due_date));
  } else if (state.highlight?.kind === "done") {
    list = list.filter((t) => t.status === "done");
  } else if (state.highlight?.kind === "all_todos") {
    // no extra filter
  } else if (state.highlight?.kind === "date") {
    list = list.filter((t) => t.due_date === state.highlight.date);
  }
  if (state.highlight?.planId) {
    list = list.filter((t) => t.plan_id === state.highlight.planId);
  }

  const [key, dir] = state.todoSort.split("_");
  const mul = dir === "asc" ? 1 : -1;
  list.sort((a, b) => {
    let av, bv;
    if (key === "due") {
      av = a.due_date || "9999-99-99";
      bv = b.due_date || "9999-99-99";
    } else if (key === "priority") {
      const order = { 상: 0, 중: 1, 하: 2 };
      av = order[a.priority];
      bv = order[b.priority];
    } else if (key === "estimated") {
      av = a.estimated_minutes;
      bv = b.estimated_minutes;
    } else {
      av = a.created_at;
      bv = b.created_at;
    }
    if (av < bv) return -1 * mul;
    if (av > bv) return 1 * mul;
    return 0;
  });
  return list;
}

function renderTodos() {
  $("#todo-sort-label").textContent = `정렬 기준: ${sortLabel(state.todoSort)}`;
  const list = $("#todo-list");
  list.textContent = "";
  const todos = filteredSortedTodos();

  if (state.highlight) {
    const bar = el("div", "highlight-bar");
    bar.appendChild(el("span", null, `돌아보기에서 넘어온 목록: ${highlightLabel(state.highlight)} (${todos.length}건)`));
    const clear = el("button", "btn btn--ghost", "필터 해제");
    clear.addEventListener("click", () => {
      clearAllTodoFilters();
    });
    bar.appendChild(clear);
    list.appendChild(bar);
  }

  if (todos.length === 0) {
    list.appendChild(el("p", "empty-note", "조건에 맞는 할 일이 없습니다."));
    return;
  }

  for (const todo of todos) {
    const row = el("article", "todo-row" + (todo.status === "done" ? " todo-row--done" : ""));
    const top = el("div", "todo-row__top");
    const title = el("strong", null, todo.title);
    top.appendChild(title);
    top.appendChild(el("span", `badge badge--${todo.priority}`, todo.priority));
    if (todo.status === "done") top.appendChild(el("span", "badge badge--done", "완료"));
    else if (isOverdueKST(todo.due_date)) top.appendChild(el("span", "badge badge--overdue", "지연"));
    if (todoBlockedReasons(todo.id).length > 0) top.appendChild(el("span", "badge badge--blocked", "막힘"));
    row.appendChild(top);

    const plan = state.plans.find((p) => p.id === todo.plan_id);
    const meta = el(
      "p",
      "todo-row__meta",
      `계획: ${plan ? plan.title : "(삭제됨)"} · 마감 ${todo.due_date || "없음"} · 예상 ${todo.estimated_minutes}분 · 실제 누적 ${todoActualMinutes(todo.id)}분 · 태그 ${(todo.tags || []).join(", ") || "없음"}`
    );
    row.appendChild(meta);

    const actions = el("div", "todo-row__actions");
    if (todo.status === "done") {
      const undoBtn = el("button", "btn btn--ghost", "되돌리기");
      undoBtn.addEventListener("click", async () => {
        await api.uncompleteTodo(todo.id);
        await loadAll();
      });
      actions.appendChild(undoBtn);
    } else {
      const doneBtn = el("button", "btn btn--primary", "완료로 표시");
      doneBtn.addEventListener("click", () => openCompleteModal(todo));
      actions.appendChild(doneBtn);
    }
    const logBtn = el("button", "btn btn--ghost", "실행 기록만 추가");
    logBtn.addEventListener("click", () => openStandaloneLogModal(todo));
    actions.appendChild(logBtn);

    const editBtn = el("button", "btn btn--ghost", "고치기");
    editBtn.addEventListener("click", () => openTodoEditForm(todo));
    actions.appendChild(editBtn);

    const delBtn = el("button", "btn btn--danger", "지우기");
    delBtn.addEventListener("click", async () => {
      if (!confirm("이 할 일을 지울까요? 지운 뒤에는 되돌릴 수 없습니다.")) return;
      await api.deleteTodo(todo.id);
      await loadAll();
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    list.appendChild(row);
  }
}

function sortLabel(v) {
  return (
    {
      created_desc: "최근 추가 순",
      created_asc: "오래된 순",
      due_asc: "마감 임박 순",
      due_desc: "마감 먼 순",
      priority_asc: "우선순위 높은 순",
      estimated_desc: "예상 시간 긴 순",
    }[v] || v
  );
}

function highlightLabel(h) {
  if (h.kind === "date") return `${h.date} 마감`;
  return { done: "완료", overdue: "지연", blocked: "막힘", all_todos: "전체" }[h.kind] || h.kind;
}

let editingTodoId = null;

function fillTodoForm(form, todo) {
  let defaultPlanId = "";
  if (todo?.plan_id) {
    defaultPlanId = todo.plan_id;
  } else if (state.todoFilter.planId !== "all") {
    defaultPlanId = state.todoFilter.planId;
  } else if (state.plans[0]) {
    defaultPlanId = state.plans[0].id;
  }
  form.plan_id.value = defaultPlanId;
  form.title.value = todo?.title ?? "";
  form.due_date.value = todo?.due_date ?? "";
  form.priority.value = todo?.priority ?? "중";
  form.tags.value = (todo?.tags || []).join(", ");
  form.estimated_minutes.value = todo?.estimated_minutes ?? 30;
}

function openTodoEditForm(todo) {
  editingTodoId = todo.id;
  const form = $("#todo-form");
  fillTodoForm(form, todo);
  $("#todo-form-title").textContent = "할 일 고치기";
  $("#todo-form-submit").textContent = "고친 내용 저장";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTodoForm() {
  editingTodoId = null;
  const form = $("#todo-form");
  fillTodoForm(form, null);
  $("#todo-form-title").textContent = "할 일 추가";
  $("#todo-form-submit").textContent = "할 일 저장";
}

guardSubmit($("#todo-form"), async (e) => {
  const f = e.target;
  if (!f.plan_id.value) {
    alert("먼저 계획을 하나 세워주세요.");
    return;
  }
  const payload = {
    plan_id: f.plan_id.value,
    title: f.title.value.trim(),
    due_date: f.due_date.value || null,
    priority: f.priority.value,
    tags: f.tags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    estimated_minutes: Number(f.estimated_minutes.value) || 0,
  };
  if (!payload.title) return;

  if (editingTodoId) {
    await api.updateTodo(editingTodoId, payload);
  } else {
    await api.createTodo(payload);
  }
  resetTodoForm();
  await loadAll();
});
$("#todo-form-reset").addEventListener("click", () => resetTodoForm());

// 검색/필터/정렬 바인딩
$("#todo-search").addEventListener("input", (e) => {
  state.todoFilter.search = e.target.value;
  renderTodos();
});
$("#todo-filter-status").addEventListener("change", (e) => {
  state.todoFilter.status = e.target.value;
  renderTodos();
});
$("#todo-filter-priority").addEventListener("change", (e) => {
  state.todoFilter.priority = e.target.value;
  renderTodos();
});
$("#todo-filter-tag").addEventListener("input", (e) => {
  state.todoFilter.tag = e.target.value;
  renderTodos();
});
$("#todo-filter-plan").addEventListener("change", (e) => {
  state.todoFilter.planId = e.target.value;
  renderTodos();
});
$("#todo-sort").addEventListener("change", (e) => {
  state.todoSort = e.target.value;
  renderTodos();
});

// 돌아보기에서 넘어온 드릴다운(highlight)뿐 아니라 검색/상태/우선순위/태그/지연 필터까지
// 전부 기본값으로 되돌린다. ("필터 해제" 버튼이 눌렀는데도 목록이 그대로였던 문제 수정)
function clearAllTodoFilters() {
  state.highlight = null;
  state.todoFilter = { search: "", status: "all", priority: "all", tag: "", planId: "all" };

  const searchEl = $("#todo-search");
  if (searchEl) searchEl.value = "";
  const statusEl = $("#todo-filter-status");
  if (statusEl) statusEl.value = "all";
  const priorityEl = $("#todo-filter-priority");
  if (priorityEl) priorityEl.value = "all";
  const tagEl = $("#todo-filter-tag");
  if (tagEl) tagEl.value = "";
  const planEl = $("#todo-filter-plan");
  if (planEl) planEl.value = "all";

  renderTodos();
}

// ---------------- 완료 / 실행 기록 모달 ----------------
function openCompleteModal(todo) {
  const modal = $("#modal");
  modal.hidden = false;
  modal.innerHTML = "";
  const box = el("div", "modal__box");
  box.appendChild(el("h3", null, `"${todo.title}" 완료 처리`));
  const form = document.createElement("form");
  form.className = "modal-form";
  form.innerHTML = `
    <label>시작 시각<input type="datetime-local" name="started_at" required></label>
    <label>끝난 시각<input type="datetime-local" name="ended_at" required></label>
    <label>실제로 걸린 시간(분)<input type="number" name="actual_minutes" min="0" required></label>
    <label>막혔던 이유(선택)<input type="text" name="blocked_reason" placeholder="없으면 비워두세요"></label>
    <div class="modal-actions">
      <button type="button" class="btn btn--ghost" id="modal-cancel">취소</button>
      <button type="submit" class="btn btn--primary">완료로 저장</button>
    </div>
  `;
  const nowVal = nowLocalInputValue();
  form.querySelector('[name="ended_at"]').value = nowVal;
  form.addEventListener("input", () => {
    const s = form.started_at.value;
    const en = form.ended_at.value;
    if (s && en) {
      const mins = minutesBetween(s + ":00", en + ":00");
      form.actual_minutes.value = mins;
    }
  });
  guardSubmit(form, async () => {
    const started = new Date(form.started_at.value).toISOString();
    const ended = new Date(form.ended_at.value).toISOString();
    const result = await api.completeTodoWithExecution(todo.id, {
      started_at: started,
      ended_at: ended,
      actual_minutes: Number(form.actual_minutes.value) || 0,
      blocked_reason: form.blocked_reason.value.trim() || null,
    });
    closeModal();
    await loadAll();
    if (result.alreadyDone) {
      // 이미 완료 상태였다면 조용히 무시(중복 기록 방지) — 안내만 표시
      flashMessage("이미 완료 처리된 할 일이라 기록을 다시 추가하지 않았습니다.");
    }
  });
  box.appendChild(form);
  modal.appendChild(box);
  $("#modal-cancel").addEventListener("click", closeModal);
}

function openStandaloneLogModal(todo) {
  const modal = $("#modal");
  modal.hidden = false;
  modal.innerHTML = "";
  const box = el("div", "modal__box");
  box.appendChild(el("h3", null, `"${todo.title}" 실행 기록 추가`));
  box.appendChild(el("p", "empty-note", "완료 여부와 관계없이 실제로 한 만큼만 남깁니다. 막혔다면 이유를 적어주세요."));
  const form = document.createElement("form");
  form.className = "modal-form";
  form.innerHTML = `
    <label>시작 시각<input type="datetime-local" name="started_at" required></label>
    <label>끝난 시각<input type="datetime-local" name="ended_at" required></label>
    <label>실제로 걸린 시간(분)<input type="number" name="actual_minutes" min="0" required></label>
    <label>막혔던 이유(선택)<input type="text" name="blocked_reason" placeholder="없으면 비워두세요"></label>
    <div class="modal-actions">
      <button type="button" class="btn btn--ghost" id="modal-cancel">취소</button>
      <button type="submit" class="btn btn--primary">기록 저장</button>
    </div>
  `;
  form.querySelector('[name="ended_at"]').value = nowLocalInputValue();
  form.addEventListener("input", () => {
    const s = form.started_at.value;
    const en = form.ended_at.value;
    if (s && en) form.actual_minutes.value = minutesBetween(s + ":00", en + ":00");
  });
  guardSubmit(form, async () => {
    await api.addStandaloneExecution(todo.id, {
      started_at: new Date(form.started_at.value).toISOString(),
      ended_at: new Date(form.ended_at.value).toISOString(),
      actual_minutes: Number(form.actual_minutes.value) || 0,
      blocked_reason: form.blocked_reason.value.trim() || null,
    });
    closeModal();
    await loadAll();
  });
  box.appendChild(form);
  modal.appendChild(box);
  $("#modal-cancel").addEventListener("click", closeModal);
}

function closeModal() {
  const modal = $("#modal");
  modal.hidden = true;
  modal.innerHTML = "";
}

function flashMessage(msg) {
  const bar = $("#flash");
  bar.textContent = msg;
  bar.hidden = false;
  setTimeout(() => (bar.hidden = true), 3500);
}

// ---------------- 실행 기록(로그) 탭 ----------------
function renderExecFormOptions() {
  const sel = $("#exec-form-todo");
  if (!sel) return;
  const keep = sel.value;
  sel.textContent = "";
  if (state.todos.length === 0) {
    sel.appendChild(new Option("먼저 할 일을 추가해주세요", ""));
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  for (const todo of state.todos) {
    const plan = state.plans.find((p) => p.id === todo.plan_id);
    const label = `${plan ? plan.title : "(삭제된 계획)"} · ${todo.title}`;
    sel.appendChild(new Option(label, todo.id));
  }
  if (keep && [...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

const execForm = $("#exec-form");
execForm.addEventListener("input", () => {
  const s = execForm.started_at.value;
  const en = execForm.ended_at.value;
  if (s && en) {
    execForm.actual_minutes.value = minutesBetween(s + ":00", en + ":00");
  }
});
guardSubmit(execForm, async (e) => {
  const f = e.target;
  if (!f.todo_id.value) {
    alert("먼저 계획과 할 일을 하나 이상 만들어주세요.");
    return;
  }
  await api.addStandaloneExecution(f.todo_id.value, {
    started_at: new Date(f.started_at.value).toISOString(),
    ended_at: new Date(f.ended_at.value).toISOString(),
    actual_minutes: Number(f.actual_minutes.value) || 0,
    blocked_reason: f.blocked_reason.value.trim() || null,
  });
  const keepTodo = f.todo_id.value;
  f.reset();
  f.todo_id.value = keepTodo;
  f.ended_at.value = nowLocalInputValue();
  await loadAll();
});

function renderExecutionLog() {
  const list = $("#exec-log-list");
  list.textContent = "";
  if (state.executions.length === 0) {
    list.appendChild(el("p", "empty-note", "아직 실행 기록이 없습니다. 할 일을 완료하거나 기록을 추가하면 여기 쌓입니다."));
    return;
  }
  const sorted = state.executions.slice().sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  for (const ex of sorted) {
    const todo = state.todos.find((t) => t.id === ex.todo_id);
    const row = el("article", "exec-row");
    row.appendChild(el("strong", null, todo ? todo.title : "(지워진 할 일)"));
    row.appendChild(
      el(
        "p",
        "exec-row__meta",
        `${formatDateTimeKST(ex.started_at)} ~ ${formatDateTimeKST(ex.ended_at)} · 실제 ${ex.actual_minutes}분`
      )
    );
    if (ex.blocked_reason) {
      row.appendChild(el("p", "exec-row__blocked", `막힌 이유: ${ex.blocked_reason}`));
    }
    list.appendChild(row);
  }
}

// ---------------- 돌아보기: 달력 ----------------
function dayStatsFor(dateStr) {
  const todos = state.todos.filter((t) => t.due_date === dateStr);
  const total = todos.length;
  const done = todos.filter((t) => t.status === "done").length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : null };
}

function pctLevelClass(pct) {
  if (pct === null) return "";
  if (pct >= 100) return "cal-lv-full";
  if (pct >= 75) return "cal-lv-4";
  if (pct >= 50) return "cal-lv-3";
  if (pct >= 25) return "cal-lv-2";
  return pct > 0 ? "cal-lv-1" : "cal-lv-0";
}

function renderReviewCalendar() {
  const grid = $("#calendar-grid");
  if (!grid) return;
  grid.textContent = "";

  const [year, month] = state.reviewMonth.split("-").map(Number); // month: 1~12
  $("#calendar-title").textContent = `${year}년 ${month}월`;

  const dows = ["일", "월", "화", "수", "목", "금", "토"];
  for (const d of dows) grid.appendChild(el("div", "calendar-dow", d));

  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay(); // 0(일)~6(토)
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = todayKST();

  for (let i = 0; i < startWeekday; i++) {
    grid.appendChild(el("div", "calendar-cell is-empty"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const { total, done, pct } = dayStatsFor(dateStr);
    const cls = ["calendar-cell", pctLevelClass(pct)];
    if (dateStr === todayStr) cls.push("is-today");
    if (total > 0) cls.push("has-data");
    cls.push("is-clickable");
    const cell = el("div", cls.filter(Boolean).join(" "));
    cell.appendChild(el("span", "cal-date", String(day)));
    if (total > 0) {
      cell.appendChild(el("span", "cal-pct", `${pct}%`));
      cell.appendChild(el("span", "cal-frac", `${done}/${total}`));
    }
    // 마감 할 일이 없는 날짜도 눌러서 이동할 수 있게 한다 (눌러도 반응이 없어 보이던 문제 수정).
    cell.addEventListener("click", () => {
      state.highlight = { kind: "date", date: dateStr };
      state.activeTab = "todos";
      state.todoFilter.planId = "all";
      renderAll();
      $("#todo-panel-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    grid.appendChild(cell);
  }
}

function shiftReviewMonth(delta) {
  const [year, month] = state.reviewMonth.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  state.reviewMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  renderReviewCalendar();
}

$("#calendar-prev").addEventListener("click", () => shiftReviewMonth(-1));
$("#calendar-next").addEventListener("click", () => shiftReviewMonth(1));
$("#calendar-today").addEventListener("click", () => {
  state.reviewMonth = todayKST().slice(0, 7);
  renderReviewCalendar();
});

// ---------------- 돌아보기 ----------------
function reviewRowFor(plan) {
  const todos = planTodos(plan.id);
  const done = todos.filter((t) => t.status === "done");
  const overdue = todos.filter((t) => t.status !== "done" && isOverdueKST(t.due_date));
  const blocked = todos.filter((t) => todoBlockedReasons(t.id).length > 0);
  const estimated = todos.reduce((s, t) => s + Number(t.estimated_minutes), 0);
  const actual = todos.reduce((s, t) => s + todoActualMinutes(t.id), 0);
  return {
    plan,
    total: todos.length,
    done: done.length,
    overdue: overdue.length,
    blocked: blocked.length,
    estimated,
    actual,
    diff: actual - estimated,
  };
}

function renderReview() {
  renderReviewCalendar();
  const container = $("#review-table");
  container.textContent = "";
  if (state.plans.length === 0) {
    container.appendChild(el("p", "empty-note", "계획을 먼저 세우면 돌아보기가 채워집니다."));
    return;
  }

  const table = document.createElement("table");
  table.className = "review-table";
  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr><th>계획</th><th>계획 수</th><th>완료</th><th>지연</th><th>막힘</th><th>예상(분)</th><th>실제(분)</th><th>차이(분)</th></tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");

  let totals = { total: 0, done: 0, overdue: 0, blocked: 0, estimated: 0, actual: 0 };

  for (const plan of state.plans) {
    const r = reviewRowFor(plan);
    totals.total += r.total;
    totals.done += r.done;
    totals.overdue += r.overdue;
    totals.blocked += r.blocked;
    totals.estimated += r.estimated;
    totals.actual += r.actual;

    const tr = document.createElement("tr");
    tr.appendChild(el("td", null, plan.title));
    tr.appendChild(makeDrillCell(r.total, plan.id, "all_todos"));
    tr.appendChild(makeDrillCell(r.done, plan.id, "done"));
    tr.appendChild(makeDrillCell(r.overdue, plan.id, "overdue"));
    tr.appendChild(makeDrillCell(r.blocked, plan.id, "blocked"));
    tr.appendChild(el("td", null, String(r.estimated)));
    tr.appendChild(el("td", null, String(r.actual)));
    tr.appendChild(el("td", r.diff > 0 ? "diff diff--over" : "diff", String(r.diff)));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const tfoot = document.createElement("tfoot");
  const totalDiff = totals.actual - totals.estimated;
  tfoot.innerHTML = `<tr><td>전체</td><td>${totals.total}</td><td>${totals.done}</td><td>${totals.overdue}</td><td>${totals.blocked}</td><td>${totals.estimated}</td><td>${totals.actual}</td><td>${totalDiff}</td></tr>`;
  table.appendChild(tfoot);

  container.appendChild(table);
  container.appendChild(el("p", "empty-note", "숫자를 누르면 그 숫자를 만든 할 일 목록으로 이동합니다."));

  renderReviewNotes();
}

function makeDrillCell(value, planId, kind) {
  const td = document.createElement("td");
  const btn = el("button", "drill-btn", String(value));
  btn.addEventListener("click", () => {
    state.highlight = { planId, kind };
    state.activeTab = "todos";
    state.todoFilter.planId = "all";
    renderAll();
    $("#todo-panel-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  td.appendChild(btn);
  return td;
}

function renderReviewNotes() {
  const box = $("#review-notes");
  box.textContent = "";
  const uncarried = state.reviewNotes.filter((n) => !n.carried_to_plan_id);
  const carried = state.reviewNotes.filter((n) => n.carried_to_plan_id);

  box.appendChild(el("h4", null, "다음 계획으로 넘길 고칠 점"));
  if (uncarried.length === 0) {
    box.appendChild(el("p", "empty-note", "아직 정한 고칠 점이 없습니다."));
  } else {
    for (const n of uncarried) {
      const row = el("div", "note-row");
      row.appendChild(el("span", null, n.note));
      const useBtn = el("button", "btn btn--ghost", "새 계획에 반영");
      useBtn.addEventListener("click", () => {
        state.pendingCarryNoteId = n.id;
        editingPlanId = null;
        const form = $("#plan-form");
        fillPlanForm(form, null);
        form.note.value = n.note;
        state.activeTab = "plans";
        renderAll();
        form.scrollIntoView({ behavior: "smooth" });
      });
      row.appendChild(useBtn);
      box.appendChild(row);
    }
  }

  if (carried.length > 0) {
    box.appendChild(el("h4", null, "이미 다음 계획으로 넘어간 고칠 점"));
    for (const n of carried) {
      const plan = state.plans.find((p) => p.id === n.carried_to_plan_id);
      box.appendChild(el("p", "empty-note", `"${n.note}" → ${plan ? plan.title : "(삭제된 계획)"}`));
    }
  }
}

guardSubmit($("#review-note-form"), async () => {
  const input = $("#review-note-input");
  const val = input.value.trim();
  if (!val) return;
  await api.addReviewNote(val);
  input.value = "";
  await loadAll();
});

// ---------------- 내보내기 ----------------
$("#export-btn").addEventListener("click", () => {
  const payload = {
    exported_at_kst: formatDateTimeKST(new Date().toISOString()),
    plans: state.plans,
    todos: state.todos,
    executions: state.executions,
    plan_revisions: state.revisions,
    review_notes: state.reviewNotes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pds-diary-export-${todayKST()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---------------- 시작 ----------------
resetPlanForm();
resetTodoForm();
loadAll().catch((err) => {
  console.error(err);
  const banner = $("#error-banner");
  banner.hidden = false;
  banner.textContent = "데이터를 불러오지 못했습니다. js/config.js에 Supabase 주소/키를 채웠는지, sql/schema.sql을 실행했는지 확인해주세요.";
});
