// KST(Asia/Seoul) 기준 날짜 유틸 — 브라우저 로컬 시간대와 무관하게 항상 서울 기준으로 계산한다.

export function todayKST() {
  // YYYY-MM-DD (서울 자정 기준 오늘)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function isOverdueKST(dueDateStr) {
  if (!dueDateStr) return false;
  return dueDateStr < todayKST();
}

export function formatDateTimeKST(isoString) {
  if (!isoString) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function nowLocalInputValue() {
  // <input type="datetime-local">에 넣기 좋은, 사용자가 지금 보고 있는 시각(KST 표시) 문자열
  const d = new Date();
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const pad = (n) => String(n).padStart(2, "0");
  return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}T${pad(kst.getHours())}:${pad(kst.getMinutes())}`;
}

export function minutesBetween(startIso, endIso) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export function uid() {
  return crypto.randomUUID();
}

// 텍스트를 항상 textContent로만 다루도록 강제하는 헬퍼(innerHTML 사용 금지 원칙 보조용)
export function setText(el, text) {
  el.textContent = text ?? "";
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
