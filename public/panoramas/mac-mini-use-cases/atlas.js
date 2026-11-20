import { groups } from "./cases.js";

const grid = document.querySelector("#case-grid");
const search = document.querySelector("#lookup");
const indexHeading = document.querySelector("#explore h2");
indexHeading.tabIndex = -1;
const searchInfo = document.querySelector("#search-info");
const empty = document.querySelector(".empty");
const dialog = document.querySelector("#case-dialog");
const reader = document.querySelector("#reader");
const lookup = new Map();
const cards = [];
let reading = null;
let opener = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function caseLink(item, className) {
  const link = el("a", className, item.title);
  link.href = "#case/" + item.id;
  return link;
}

function normalize(value) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

for (const group of groups) {
  const article = el("article", "scene-card");
  article.dataset.group = group.id;
  const head = el("div", "card-head");
  const heading = el("div", "card-heading");
  const english = el("small", "", group.en);
  english.lang = "en";
  heading.append(english, el("h3", "", group.name));
  const miniature = el("div", "miniature " + group.id);
  miniature.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 6; i++) miniature.append(el("i"));
  head.append(heading, miniature);

  const body = el("div", "card-body");
  const links = el("div", "case-links");
  const rows = group.cases.map((item) => {
    const link = caseLink(item);
    const plus = el("i", "plus");
    plus.setAttribute("aria-hidden", "true");
    link.append(plus);
    links.append(link);
    lookup.set(item.id, { group, item, link });
    const terms = [
      group.name, group.en, item.title, item.teaser, item.kit,
      ...item.steps.map((step) => step.title + " " + step.text),
      item.result, item.limit, ...item.sources.map((source) => source.name),
    ];
    return { link, text: normalize(terms.join(" ")) };
  });
  body.append(el("p", "summary", group.summary), links);
  article.append(head, body);
  grid.append(article);
  cards.push({ article, rows });
}

function filterCases() {
  const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  let count = 0;
  for (const { article, rows } of cards) {
    let visible = 0;
    for (const row of rows) {
      const match = words.every((word) => row.text.includes(word));
      row.link.hidden = !match;
      if (match) visible++;
    }
    article.hidden = visible === 0;
    count += visible;
  }
  empty.hidden = count !== 0;
  searchInfo.textContent = words.length ? `找到 ${count} 个案例` : `共 ${count} 个案例`;
}

search.addEventListener("input", filterCases);
document.querySelector("#reset-search").addEventListener("click", () => {
  search.value = "";
  filterCases();
  search.focus();
});
filterCases();

function readerSection(className, heading, text) {
  const section = el("section", className);
  section.append(el("h3", "", heading), el("p", "", text));
  return section;
}

function renderCase({ group, item }) {
  document.querySelector("#case-group").textContent = group.name;
  dialog.dataset.group = group.id;
  const content = el("div", "reader-content");
  const title = el("h2", "", item.title);
  title.id = "case-title";
  title.tabIndex = -1;
  const kit = el("div", "kit");
  kit.append(el("b", "", "需要准备"), el("span", "", item.kit));
  const steps = el("ol", "steps");
  for (const step of item.steps) {
    const li = el("li");
    li.append(el("strong", "", step.title), el("p", "", step.text));
    steps.append(li);
  }
  const sources = el("div", "reader-sources");
  for (const source of item.sources) {
    const url = new URL(source.url);
    if (url.protocol !== "https:") continue;
    const link = el("a", "", source.name);
    link.href = url.href;
    sources.append(link);
  }
  content.append(
    title, el("p", "teaser", item.teaser), kit, el("h3", "", "操作步骤"), steps,
    readerSection("outcome", "完成标准", item.result),
    readerSection("limit", "使用条件", item.limit),
    el("h3", "", "参考资料"), sources,
  );
  const adjacent = group.cases[(group.cases.indexOf(item) + 1) % group.cases.length];
  if (adjacent !== item) {
    const next = caseLink(adjacent, "reader-next");
    next.prepend("同组案例 · ");
    content.append(next);
  }
  reader.replaceChildren(content);
  return title;
}

function caseFromLocation() {
  return location.hash.startsWith("#case/") ? lookup.get(location.hash.slice(6)) : undefined;
}

function syncReader() {
  const entry = caseFromLocation();
  if (!entry) {
    if (!reading) return;
    const focusAfterClose = opener || (location.hash === "#explore" ? indexHeading : reading.link);
    reading = null;
    opener = null;
    dialog.close();
    // History traversal can move focus to the fragment after it fires popstate.
    requestAnimationFrame(() => {
      if (!reading) (focusAfterClose.hidden ? search : focusAfterClose).focus({ preventScroll: true });
    });
    return;
  }
  if (reading === entry && dialog.open) return;
  reading = entry;
  const title = renderCase(entry);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  reader.scrollTop = 0;
  title.focus({ preventScroll: true });
}

function followCase(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a[href^='#case/']");
  if (!link || !lookup.has(link.hash.slice(6))) return;
  event.preventDefault();
  if (reading) {
    history.replaceState(history.state, "", link.hash);
  } else {
    opener = link;
    history.pushState({ ...history.state, macMiniReader: true }, "", link.hash);
  }
  syncReader();
}
grid.addEventListener("click", followCase);
reader.addEventListener("click", followCase);

function requestClose() {
  if (history.state?.macMiniReader) {
    history.back();
  } else {
    history.replaceState(history.state, "", "#explore");
    syncReader();
  }
}
document.querySelector("#dismiss").addEventListener("click", requestClose);
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  requestClose();
});
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const { top, right, bottom, left } = dialog.getBoundingClientRect();
  if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
    requestClose();
  }
});
window.addEventListener("popstate", syncReader);
window.addEventListener("hashchange", syncReader);

// A shared case URL gets the same Back-to-index behavior as a card opened in the page.
if (caseFromLocation() && !history.state?.macMiniReader) {
  const original = location.href;
  history.replaceState(history.state, "", "#explore");
  history.pushState({ ...history.state, macMiniReader: true }, "", original);
}
syncReader();

const notes = document.querySelector("#port-notes");
const face = document.querySelector("#face");
const frontNotes = notes.cloneNode(true);
const frontImage = { src: face.getAttribute("src"), alt: face.alt };
const sideButtons = document.querySelectorAll(".seg [data-side]");

function showHardware(side) {
  const back = side === "back";
  for (const button of sideButtons) button.setAttribute("aria-pressed", String(button.dataset.side === side));
  face.src = back ? "/panoramas/mac-mini-use-cases/back.webp" : frontImage.src;
  face.alt = back ? "Mac mini 背面，从左到右依次为电源、以太网、HDMI 和三个雷雳端口" : frontImage.alt;
  if (!back) {
    notes.replaceChildren(...Array.from(frontNotes.children, (child) => child.cloneNode(true)));
    return;
  }
  const list = el("dl");
  const connections = [
    ["电源与以太网", "接上电源线，按需连接路由器或交换机。两款均配备 2.5Gb 以太网，可选配 10Gb 以太网。"],
    ["HDMI", "用 HDMI 线连接显示器、电视或投影仪，也可将声音输出至支持的显示设备。"],
    ["雷雳 × 3", "可接显示器、高速存储和扩展坞。M6 配备雷雳 4，M5 Pro 配备雷雳 5。"],
  ];
  for (const [name, description] of connections) list.append(el("dt", "", name), el("dd", "", description));
  notes.replaceChildren(el("h3", "", "把固定连接留在背面"), list);
}
for (const button of sideButtons) {
  button.addEventListener("click", () => {
    if (button.getAttribute("aria-pressed") !== "true") showHardware(button.dataset.side);
  });
}
