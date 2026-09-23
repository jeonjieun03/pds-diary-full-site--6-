// ---- 배경 장식: 메인화면(트링킷 콜라주)과 같은 이미지들을 좌우 여백에 랜덤 배치 ----
// b64.js(전역 IMG 객체)가 이 스크립트보다 먼저 로드되어 있어야 합니다.
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  const NAMES = [
    "tomato", "snail", "cat_bow", "penguin", "mushroom", "hamster",
    "jumping_cat", "crocodile", "squirrel_cat", "clover_ball", "sleeping_cat",
    "elephant", "deer",
  ];
  // 각 트링킷 원본 이미지의 세로/가로 비율(대략) — 겹침 계산용
  const ASPECT = {
    squirrel_cat: 1.5015, elephant: 1.0, crocodile: 0.99, snail: 0.86,
    clover_ball: 1.3307, hamster: 1.3333, mushroom: 0.75, deer: 1.0,
    penguin: 1.2019, cat_bow: 1.3333, jumping_cat: 1.3333, tomato: 0.75,
    sleeping_cat: 1.0,
  };

  const MIN_MARGIN_FOR_DECOR = 130; // 이 정도 여백은 있어야 장식을 채움
  const MIN_SIZE = 40;
  const MAX_SIZE = 104;

  function contentBounds() {
    const ref = document.querySelector(".page-header") || document.querySelector("main");
    if (!ref) return null;
    const r = ref.getBoundingClientRect();
    return { left: r.left + window.scrollX, right: r.right + window.scrollX };
  }

  function overlaps(rect, rects, pad) {
    return rects.some(
      (o) => !(rect.x1 + pad <= o.x0 || o.x1 + pad <= rect.x0 || rect.y1 + pad <= o.y0 || o.y1 + pad <= rect.y0)
    );
  }

  function layout() {
    const host = document.getElementById("bg-trinkets");
    if (!host || typeof IMG === "undefined") return;
    host.innerHTML = "";

    const bounds = contentBounds();
    if (!bounds) return;
    const docWidth = document.documentElement.scrollWidth;
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    host.style.height = docHeight + "px";

    const leftMargin = bounds.left;
    const rightMargin = docWidth - bounds.right;

    const sides = [];
    if (leftMargin >= MIN_MARGIN_FOR_DECOR) sides.push({ from: 8, to: bounds.left - 8 });
    if (rightMargin >= MIN_MARGIN_FOR_DECOR) sides.push({ from: bounds.right + 8, to: docWidth - 8 });
    if (sides.length === 0) return;

    const rects = [];
    for (const side of sides) {
      const sideWidth = side.to - side.from;
      if (sideWidth < MIN_SIZE) continue;
      const maxItems = Math.max(5, Math.round(docHeight / 150));
      let placed = 0;
      let attempts = 0;
      while (placed < maxItems && attempts < maxItems * 80) {
        attempts++;
        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
        const aspect = ASPECT[name] || 1;
        const capW = Math.min(MAX_SIZE, sideWidth - 4);
        if (capW < MIN_SIZE) break;
        const w = MIN_SIZE + Math.random() * (capW - MIN_SIZE);
        const h = w * aspect;
        const x0 = side.from + Math.random() * Math.max(1, sideWidth - w);
        const y0 = 20 + Math.random() * Math.max(1, docHeight - h - 40);
        const rect = { x0, y0, x1: x0 + w, y1: y0 + h };
        if (overlaps(rect, rects, 6)) continue;
        rects.push(rect);
        placed++;

        const img = document.createElement("img");
        img.src = IMG[name];
        img.alt = "";
        img.className = "bg-trinket";
        const rot = (Math.random() * 50 - 25).toFixed(1);
        img.style.left = x0 + "px";
        img.style.top = y0 + "px";
        img.style.width = w + "px";
        img.style.transform = `rotate(${rot}deg)`;
        host.appendChild(img);
      }
    }
  }

  // 화면 크기(가로/세로)가 실제로 바뀌었을 때만 다시 배치한다.
  // (검색창에 타이핑하거나 목록이 다시 그려지는 것처럼 크기와 무관한 변화에는 반응하지 않음 —
  //  그래야 이미지가 계속 깜빡이며 다시 배치되는 일이 없다.)
  let lastW = 0;
  let lastH = 0;
  let timer = null;

  function scheduleLayout() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = document.documentElement.scrollWidth;
      const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      if (Math.abs(w - lastW) < 4 && Math.abs(h - lastH) < 4) return; // 의미 있는 변화가 없으면 건너뜀
      lastW = w;
      lastH = h;
      layout();
    }, 400);
  }

  ready(() => {
    layout();
    lastW = document.documentElement.scrollWidth;
    lastH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

    window.addEventListener("resize", scheduleLayout);

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(scheduleLayout);
      ro.observe(document.body);
    } else {
      // 구형 브라우저 대비: 크기 변화만 골라내는 안전판으로 드물게 확인
      setInterval(scheduleLayout, 1500);
    }
  });
})();
