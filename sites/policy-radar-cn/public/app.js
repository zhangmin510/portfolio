const state = { data: null, live: [], filter: "all" };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function switchView(view) {
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSignalBars(level = 1) {
  return `<span class="signal-bars" title="信号强度 ${level}/5">${[1,2,3,4,5].map((n) => `<i class="${n <= level ? "on" : ""}"></i>`).join("")}</span>`;
}

function renderFeed() {
  const feed = $("#live-feed");
  const items = state.filter === "all" ? state.live : state.live.filter((item) => item.sourceKind === state.filter);
  if (!items.length) {
    feed.innerHTML = `<div class="empty-state">当前筛选下暂无条目。请稍后刷新，或直接访问中国政府网核验。</div>`;
    return;
  }
  feed.innerHTML = items.slice(0, 16).map((item) => `
    <a class="feed-item" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <span class="feed-date">${escapeHtml(item.date || "待更新")}</span>
      <span class="feed-copy"><strong>${escapeHtml(item.title)}</strong><small><span class="type-pill">${escapeHtml(item.type)}</span>${escapeHtml(item.source)} · ${escapeHtml(item.tone)}信号</small></span>
      ${renderSignalBars(item.signalLevel)}
    </a>`).join("");
}

async function loadLive(force = false) {
  const button = $("#refresh-live");
  button.disabled = true; button.textContent = "同步中";
  $("#live-state").textContent = "正在同步官方源";
  try {
    const response = await fetch(`/api/live${force ? "?fresh=1" : ""}`);
    if (!response.ok) throw new Error("live source unavailable");
    const payload = await response.json();
    state.live = payload.items || [];
    $("#meeting-count").textContent = payload.meetingCount ?? "—";
    $("#policy-count").textContent = payload.policyCount ?? "—";
    $("#source-date").textContent = payload.sourceUpdatedAt || "已连接";
    $("#data-status").textContent = payload.ok ? "已同步" : "部分可用";
    $("#live-state").textContent = "官方源已连接";
    renderFeed();
  } catch (error) {
    $("#data-status").textContent = "暂时离线";
    $("#live-state").textContent = "官方源稍后重试";
    $("#live-feed").innerHTML = `<div class="empty-state">暂时无法读取官方列表。历史对比与解读框架仍可正常使用。</div>`;
  } finally {
    button.disabled = false; button.textContent = "刷新";
  }
}

function renderMeetingMap() {
  $("#meeting-grid").innerHTML = state.data.meetingMap.map((meeting, index) => `
    <article class="meeting-card">
      <span class="meeting-index">0${index + 1}</span><span class="meeting-tag">${escapeHtml(meeting.type)}</span>
      <h2>${escapeHtml(meeting.name)}</h2><div class="meeting-meta">${escapeHtml(meeting.rhythm)} · 影响期 ${escapeHtml(meeting.horizon)}</div>
      <div class="meeting-output"><span>主要产出</span><strong>${escapeHtml(meeting.output)}</strong></div>
      <div class="meeting-watch"><span class="panel-kicker">重点看什么</span>${escapeHtml(meeting.watch)}</div>
    </article>`).join("");
}

function historyCard(item) {
  return `<article class="history-card">
    <span class="date">${escapeHtml(item.month)} · ${escapeHtml(item.type)}</span>
    <h3>${escapeHtml(item.title)}</h3>
    <dl>
      <div><dt>核心主题</dt><dd>${escapeHtml(item.theme)}</dd></div>
      <div><dt>关键信号</dt><dd>${escapeHtml(item.signal)}</dd></div>
      <div><dt>政策变化</dt><dd>${escapeHtml(item.change)}</dd></div>
      <div><dt>落地证据</dt><dd>${escapeHtml(item.evidence)}</dd></div>
    </dl>
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看${escapeHtml(item.source)}原文 ↗</a>
  </article>`;
}

function renderComparison() {
  const yearA = Number($("#year-a").value);
  const yearB = Number($("#year-b").value);
  const itemsA = state.data.timeline.filter((item) => item.year === yearA);
  const itemsB = state.data.timeline.filter((item) => item.year === yearB);
  $("#year-a-column").innerHTML = `<div class="year-title"><strong>${yearA}</strong><span>${itemsA.length} 个关键样本</span></div>${itemsA.map(historyCard).join("")}`;
  $("#year-b-column").innerHTML = `<div class="year-title"><strong>${yearB}</strong><span>${itemsB.length} 个关键样本</span></div>${itemsB.map(historyCard).join("")}`;
  const topicsA = itemsA.map((item) => item.theme).join("、") || "无样本";
  const topicsB = itemsB.map((item) => item.theme).join("、") || "无样本";
  $("#compare-summary").innerHTML = `<strong>${yearA} → ${yearB}</strong><span>主题从“${escapeHtml(topicsA)}”延伸至“${escapeHtml(topicsB)}”。请结合原文继续检查措辞、排序、指标和资源变化。</span>`;
}

function renderTimeline() {
  const years = [...new Set(state.data.timeline.map((item) => item.year))];
  const options = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  $("#year-a").innerHTML = options; $("#year-b").innerHTML = options;
  $("#year-a").value = years.includes(2022) ? "2022" : String(years[0]);
  $("#year-b").value = String(years.at(-1));
  $("#timeline-strip").innerHTML = state.data.timeline.map((item) => `<button class="timeline-point" data-year="${item.year}"><strong>${item.year}</strong><span>${escapeHtml(item.title)}</span></button>`).join("");
  renderComparison();
}

function renderFramework() {
  $("#framework-steps").innerHTML = state.data.framework.map((item, index) => `
    <article class="framework-step ${index === 0 ? "is-open" : ""}">
      <button class="framework-trigger" aria-expanded="${index === 0}">
        <span class="framework-no">${escapeHtml(item.step)}</span><span class="framework-title">${escapeHtml(item.title)}</span>
        <span class="framework-question">${escapeHtml(item.question)}</span><span class="framework-plus">＋</span>
      </button>
      <div class="framework-body"><strong>输出：${escapeHtml(item.output)}</strong><br />${escapeHtml(item.detail)}</div>
    </article>`).join("");
  $("#verb-ladder").innerHTML = state.data.verbLadder.map((item) => `<div class="verb-level"><span>${item.level}</span><div><strong>${escapeHtml(item.label)} · ${escapeHtml(item.stage)}</strong><small>${escapeHtml(item.action)}</small></div></div>`).join("");
  $("#source-grid").innerHTML = state.data.sourceCards.map((item) => `<a class="source-card" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.title)} ↗</strong><p>${escapeHtml(item.note)}</p></a>`).join("");
}

async function init() {
  $("#footer-time").textContent = `页面时间 ${new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date())}`;
  try {
    state.data = await fetch("/api/data").then((response) => response.json());
    $("#history-count").textContent = state.data.timeline.length;
    renderMeetingMap(); renderTimeline(); renderFramework();
  } catch (error) {
    $("#data-status").textContent = "内容加载失败";
  }

  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  $$(".segment").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.feedFilter;
    $$(".segment").forEach((segment) => segment.classList.toggle("is-active", segment === button));
    renderFeed();
  }));
  $("#refresh-live").addEventListener("click", () => loadLive(true));
  $("#year-a").addEventListener("change", renderComparison); $("#year-b").addEventListener("change", renderComparison);
  $("#timeline-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-year]"); if (!button) return;
    $("#year-b").value = button.dataset.year; renderComparison();
  });
  $("#framework-steps").addEventListener("click", (event) => {
    const trigger = event.target.closest(".framework-trigger"); if (!trigger) return;
    const item = trigger.closest(".framework-step"); item.classList.toggle("is-open"); trigger.setAttribute("aria-expanded", String(item.classList.contains("is-open")));
  });
  const initial = location.hash.slice(1); if (["radar", "map", "compare", "framework"].includes(initial)) switchView(initial);
  loadLive();
}

init();
