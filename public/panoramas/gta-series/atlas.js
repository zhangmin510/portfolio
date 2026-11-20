import { games } from './records.js';

const gameById = new Map(games.map(game => [game.id, game]));
const eraNames = { '2d': '2D 时代', '3d': '3D 时代', hd: 'HD 时代' };
const textOnly = new Set(['london61']);
const cities = {
  liberty: {
    name: '自由城的三个入口',
    description: '初代从高空看这座城。《GTA III》让人从波特兰岛一路认到海岸之谷。《GTA IV》又从移民抵达的码头重新画起，随后两部剧情扩展让人用摩托车手和夜店雇员的身份重走那些街道。',
  },
  vice: {
    name: '罪恶城的两种年代',
    description: '在《罪恶都市》和它的掌机前传里，电台、海滨酒店与霓虹招牌留下了八十年代的声音和颜色。《GTA VI》再次使用 Vice City 这个名字，把这座城放进当代雷奥奈达州。',
  },
  san: {
    name: '圣安地列斯，从城名到州名',
    description: '初代的 San Andreas 是一座城市。2004 年，它成了横跨洛圣都、San Fierro 和 Las Venturas 的州。《GTA V》把镜头拉回南部，让洛圣都与布雷恩郡承载三位主角截然不同的日常。',
  },
  london: {
    name: '伦敦，把发行年份和故事年份分开看',
    description: '两部伦敦任务包都发行于 1999 年，标题里的数字指向不同的故事年代。先推出的作品设在 1969 年，随后发布的 PC 追加内容把故事往前拨了八年。',
  },
  anywhere: {
    name: 'Anywhere City，一座由帮派分区的城',
    description: '《GTA 2》把背景设在带有复古未来感的 Anywhere City。玩家从闹市走向住宅区与工业区，每到一地，都要重新了解当地有哪些势力，以及它们如何看待主角。',
  },
};

const comparisons = [
  {
    label: '镜头与街道',
    examples: [
      ['gta1', '从街区上空选路', '路口和车流同时铺在眼前。玩家可以先看出哪条支路通往目标，再决定在哪里转弯。读地图本身就是驾驶的一部分。'],
      ['gta3', '从车窗边认路', '镜头落到街面，前方的建筑挡住下一个路口。桥头的坡度、街角的店面和转弯后出现的天际线，成了记路的线索。'],
    ],
  },
  {
    label: '城市的尺度',
    examples: [
      ['san', '三座城市之间的路', '从洛圣都出发，公路要穿过乡村、山地和沙漠才到下一座大城。地貌的变化让长途驾驶成为旅程本身。'],
      ['gta5', '同一都会的三种生活', '富兰克林的街区、迈克尔的豪宅与崔佛的乡间住处，共同勾出南圣安地列斯。切换角色也会改变玩家观察这片土地的位置。'],
    ],
  },
  {
    label: '掌机的取舍',
    examples: [
      ['lcs', '把三维街区带到掌中', 'PSP 版沿用自由城熟悉的城市轮廓，写下托尼的新故事。回到尚在施工的街区，玩家得为熟知的目的地另找一条路。'],
      ['chinatown', '为两块屏幕重画街区', 'DS 把地图、通讯和触控操作放在下屏，上屏以俯视镜头留出驾驶视野。玩家一边看路，一边用触控笔与随身设备打交道。'],
    ],
  },
  {
    label: '谁坐在副驾',
    examples: [
      ['gta5', '一个人切换三位主角', '同一场行动由三个已有生活轨迹的人共同完成。在允许切换的段落，玩家可以换到搭档的位置，从另一个视角经历同一件事。'],
      ['online', '把位置留给另一位玩家', '自创角色与朋友共享街道。一个人负责开车，另一个人决定下车后要做什么。协作的节奏交给了同场玩家。'],
    ],
  },
];

const list = document.querySelector('#game-list');
const detail = document.querySelector('#game-detail');
let era = 'all';
let selected = games[0];
let visibleGames = games;

function showList() {
  visibleGames = era === 'all' ? games : games.filter(game => game.era === era);
  list.innerHTML = visibleGames.map(game => `
    <button class="game-row" type="button" data-game="${game.id}" aria-pressed="false">
      <span class="year">${game.year}</span><span class="name">${game.name}</span>
    </button>`).join('');
  document.querySelector('#archive-count').textContent = visibleGames.length + ' 项';
  for (const button of document.querySelectorAll('[data-era]')) {
    button.setAttribute('aria-pressed', String(button.dataset.era === era));
  }
}

function showGame(game, revealRow = true) {
  selected = game;
  if (!visibleGames.includes(game)) {
    era = 'all';
    showList();
  }
  const position = visibleGames.indexOf(game);
  const art = textOnly.has(game.id)
    ? `<div class="type-cover" aria-hidden="true"><small>${eraNames[game.era]}</small><b>${game.year}</b></div>`
    : `<img class="record-cover" src="./covers/${game.id}.webp" alt="${game.name} 官方作品图像" width="300" height="400"><figcaption>官方作品图像</figcaption>`;
  detail.innerHTML = `
    <figure class="record-art">${art}</figure>
    <div class="record-header">
      <p class="record-tag">${game.year} 年首发 · ${eraNames[game.era]} · ${game.kind}</p>
      <h3 class="record-name" lang="en">${game.name}</h3>
      <p class="record-zh">${game.zh}</p>
      <dl class="record-facts"><dt>舞台</dt><dd>${game.setting}</dd><dt>首发平台</dt><dd>${game.platform}</dd></dl>
    </div>
    <div class="record-body">
      ${game.id === 'gta6' ? '<a class="guide-entry" href="#gta6-guide">打开 GTA VI 无剧透攻略</a>' : ''}
      <h4 class="record-headline">${game.headline}</h4>
      <p class="record-text">${game.story}</p><p class="record-text">${game.design}</p>
      <a class="record-source" href="${game.source}">${game.sourceName}</a>
    </div>`;
  document.querySelector('#record-position').textContent = (position + 1) + ' / ' + visibleGames.length;
  document.querySelector('#previous').disabled = position === 0;
  document.querySelector('#next').disabled = position === visibleGames.length - 1;
  for (const button of list.children) {
    button.setAttribute('aria-pressed', String(button.dataset.game === game.id));
  }
  for (const link of document.querySelectorAll('.mainline-route a')) {
    if (link.hash === '#game-' + game.id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  if (revealRow) {
    const row = list.children[position];
    const top = row.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + row.offsetHeight - list.clientHeight;
    }
  }
}

function selectInPlace(game) {
  showGame(game);
  const hash = '#game-' + game.id;
  if (location.hash !== hash) history.pushState(null, '', hash);
}

for (const button of document.querySelectorAll('[data-era]')) {
  button.addEventListener('click', () => {
    era = button.dataset.era;
    showList();
    selectInPlace(visibleGames.includes(selected) ? selected : visibleGames[0]);
  });
}
list.addEventListener('click', event => {
  const row = event.target.closest('[data-game]');
  if (row) selectInPlace(gameById.get(row.dataset.game));
});
function turnPage(offset) {
  selectInPlace(visibleGames[visibleGames.indexOf(selected) + offset]);
  if (window.matchMedia('(max-width: 700px)').matches) focusDossier();
}
document.querySelector('#previous').addEventListener('click', () => turnPage(-1));
document.querySelector('#next').addEventListener('click', () => turnPage(1));

function showCity(id) {
  const city = cities[id];
  const lineage = games.filter(game => game.cities.includes(id)).map(game =>
    `<a href="#game-${game.id}"><time>${game.year}</time>${game.name}</a>`).join('');
  document.querySelector('#city-detail').innerHTML = `
    <div><h3>${city.name}</h3><p>${city.description}</p></div>
    <nav class="lineage" aria-label="在此地登场的作品">${lineage}</nav>`;
  for (const button of document.querySelectorAll('[data-city]')) {
    button.setAttribute('aria-pressed', String(button.dataset.city === id));
  }
}
for (const button of document.querySelectorAll('[data-city]')) {
  button.addEventListener('click', () => showCity(button.dataset.city));
}

const choices = document.querySelector('#design-choices');
choices.innerHTML = comparisons.map((comparison, i) => `<button type="button" data-comparison="${i}">${comparison.label}</button>`).join('');
function showComparison(index) {
  document.querySelector('#comparison').innerHTML = '<div class="comparison-grid">' +
    comparisons[index].examples.map(([id, title, body]) => {
      const game = gameById.get(id);
      return `<article><time>${game.year}</time><h3>${title}</h3><p>${body}</p><a href="#game-${id}">${game.name} 作品档案</a></article>`;
    }).join('') + '</div>';
  for (const button of choices.children) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.comparison) === index));
  }
}
choices.addEventListener('click', event => {
  const button = event.target.closest('[data-comparison]');
  if (button) showComparison(Number(button.dataset.comparison));
});

function focusDossier() {
  const panel = document.querySelector('#dossier');
  panel.focus({ preventScroll: true });
  panel.scrollIntoView({ block: 'start' });
}
function openLinkedGame(hash) {
  const game = gameById.get(hash.replace(/^#game-/, ''));
  if (!game) return;
  showGame(game);
  focusDossier();
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#game-"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (location.hash !== link.hash) history.pushState(null, '', link.hash);
  openLinkedGame(link.hash);
});
window.addEventListener('hashchange', () => openLinkedGame(location.hash));

showList();
showGame(selected, false);
showCity('liberty');
showComparison(0);
if (location.hash.startsWith('#game-')) openLinkedGame(location.hash);

// The dossier above the guide can change height when a saved page is reloaded.
window.addEventListener('pageshow', event => {
  if (event.persisted || location.hash !== '#gta6-guide') return;
  requestAnimationFrame(() => {
    if (location.hash === '#gta6-guide') document.querySelector('#gta6-guide').scrollIntoView();
  });
});
