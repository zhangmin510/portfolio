const vendors = ['OpenAI', 'Anthropic', 'Google'];
const years = ['2023', '2024', '2025', '2026'];
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unique = values => [...new Set(values)];
const badge = name => `<span class="vendor" data-brand="${esc(name)}">${esc(name)}</span>`;
const visit = (url, label, cls) => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const dialogs = $('detail');
const views = ['catalog', 'timeline', 'method'];
const categoryColors = ['#6867a8','#57867b','#a77a50','#697ca4','#8d709e','#83874e','#597f91','#9f6e69'];
let entries = [];
let categories = [];
let limit = 12;
let lastFocus;
let view = 'catalog';
function parameters() {return new URLSearchParams(location.search);}
function currentView() {
  const anchor = location.hash.slice(1);
  if (views.includes(anchor)) return anchor;
  const from = parameters().get('view');
  return views.includes(from) ? from : 'catalog';
}
function detailId() {return location.hash.startsWith('#b/') ? location.hash.slice(3) : '';}
function detailLink(id) {
  const url = new URL(location.href);
  if (view === 'catalog') url.searchParams.delete('view'); else url.searchParams.set('view', view);
  url.hash = 'b/' + id;
  return url.pathname + url.search + url.hash;
}
function applyFilterQuery() {
  const url = new URL(location.href);
  for (const key of ['provider','year','category','query']) {
    const value = $(key).value.trim();
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
  limit = 12;
  renderResults();
}
function navigateView(next, scroll = false) {
  const url = new URL(location.href);
  url.hash = next;
  url.searchParams.delete('view');
  history.pushState(null, '', url);
  syncLocation();
  if (scroll) $('workspace').scrollIntoView({block:'start'});
}
function matrix() {
  const counts = vendors.map(name => years.map(y => entries.filter(entry => entry.uses.some(u => u.provider === name && u.date.startsWith(y))).length));
  const max = Math.max(...counts.flat());
  const tones = ['#e1dcff','#c1b4ef','#a591dc','#7e68ba','#5e4a98'];
  $('matrix').innerHTML = '<table aria-label="各厂商每年已收录的不同基准数"><thead><tr><th scope="col">厂商</th>' +
    years.map(y => `<th scope="col">${y}</th>`).join('') + '</tr></thead><tbody>' +
    vendors.map((name,i) => `<tr><th scope="row">${name}</th>`+counts[i].map((n,j) => {
      if (!n) return '<td><span class="matrix-zero" aria-label="尚未收录">—</span></td>';
      const tone = Math.min(4,Math.floor(Math.sqrt(n/max)*4.99));
      return `<td><button type="button" data-v="${name}" data-y="${years[j]}" aria-label="${name}，${years[j]} 年，${n} 项基准" style="--cell:${tones[tone]};--cell-ink:${tone>2?'#fff':'#242135'}">${n}</button></td>`;
    }).join('')+'</tr>').join('')+'</tbody></table>';
}
function filterEntries() {
  const provider = $('provider').value, year = $('year').value, category = $('category').value;
  const query = $('query').value.trim().toLocaleLowerCase();
  const filtered = [];
  for (const entry of entries) {
    if (category && entry.category !== category) continue;
    let uses = entry.uses.filter(u => (!year || u.date.startsWith(year)) && (!vendors.includes(provider) || provider === u.provider));
    const inDescription = [entry.name,entry.about,entry.category,entry.id,entry.example,entry.metric,entry.method].join(' ').toLocaleLowerCase().includes(query);
    if (query && !inDescription) uses = uses.filter(u => (u.model+' '+u.provider).toLocaleLowerCase().includes(query));
    if (!uses.length || (provider === 'shared' && unique(uses.map(u=>u.provider)).length !== vendors.length)) continue;
    filtered.push({entry,uses});
  }
  return filtered;
}
function catalogItem({entry,uses}) {
  const labels = vendors.filter(v=>uses.some(u=>u.provider === v)).map(badge).join('');
  const color = categoryColors[categories.indexOf(entry.category) % categoryColors.length];
  return `<a class="bench-card" href="${esc(detailLink(entry.id))}" data-entry="${esc(entry.id)}" style="--line-color:${color}"><div class="card-kicker"><span>${esc(entry.category)}</span><span class="open-mark" aria-hidden="true">＋</span></div><h3>${esc(entry.name)}</h3><p>${esc(entry.about)}</p><div class="badges">${labels}</div></a>`;
}
function reportGroups(filtered) {
  const groups = new Map();
  for (const {entry,uses} of filtered) for (const u of uses) {
    const key = [u.provider,u.date,u.url.split('#')[0]].join('|');
    if (!groups.has(key)) groups.set(key, {provider:u.provider,date:u.date,url:u.url,models:new Set(),benchmarks:new Map()});
    const g = groups.get(key);
    g.models.add(u.model);
    g.benchmarks.set(entry.id,entry.name);
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date) || a.provider.localeCompare(b.provider));
}
function timeline(groups) {
  let year = '';
  return groups.map(g => {
    const y = g.date.slice(0,4);
    const heading = y !== year ? `<h3 class="time-year">${y}</h3>` : '';
    year = y;
    const names = [...g.benchmarks].map(([id,name])=>`<a data-entry="${esc(id)}" href="${esc(detailLink(id))}">${esc(name)}</a>`).join('');
    return heading+`<article class="report"><time class="record-date" datetime="${g.date}">${g.date}</time><div><header>${badge(g.provider)}${visit(g.url,'查看官方资料','source-link')}</header><h4>${esc([...g.models].join(' · '))}</h4><div class="report-bench">${names}</div></div></article>`;
  }).join('');
}
function renderResults() {
  if (view === 'method') return;
  const filtered = filterEntries();
  const isCatalog = view === 'catalog';
  const rows = isCatalog ? filtered : reportGroups(filtered);
  $('catalog-list').hidden = !isCatalog;
  $('timeline-list').hidden = isCatalog;
  $('view-title').textContent = isCatalog ? '评测基准' : '官方报告';
  $('result-count').textContent = isCatalog ? `${rows.length} 项基准` : `${rows.length} 组报告记录`;
  $('clear').hidden = !['provider','year','category','query'].some(key=>$(key).value);
  $('empty').hidden = rows.length > 0;
  $('more').hidden = rows.length <= limit;
  $('more').textContent = `再显示 ${Math.min(Math.max(0,rows.length-limit),12)} ${isCatalog?'项基准':'组记录'}`;
  const page = rows.slice(0,limit);
  if (isCatalog) $('catalog-list').innerHTML = page.map(catalogItem).join('');
  else $('timeline-list').innerHTML = timeline(page);
}
function renderDetail(entry, showAll = false) {
  const matches = filterEntries().find(item=>item.entry.id===entry.id)?.uses;
  const partial = matches && matches.length < entry.uses.length;
  const selected = partial && !showAll ? matches : entry.uses;
  const toggle = partial ? `<button id="show-all" type="button">${showAll?'只看当前筛选':'查看全部 '+entry.uses.length+' 条'}</button>` : '';
  const rows = [...selected].sort((a,b)=>b.date.localeCompare(a.date) || a.provider.localeCompare(b.provider));
  $('detail-body').innerHTML = `<div class="detail-tag">${esc(entry.category)}</div><h2 id="detail-title">${esc(entry.name)}</h2><p class="detail-intro">${esc(entry.about)}</p>${visit(entry.origin,'基准原始资料','origin-link')}
    <section class="sample"><h3>题目示例 · 教学编写</h3><p>${esc(entry.example)}</p>${entry.publicExample ? '<div class="real-example">公开原题 · '+visit(entry.publicExample.url,esc(entry.publicExample.label),'origin-link')+'</div>' : ''}</section>
    <div class="detail-grid"><section class="detail-section"><h3>指标</h3><p>${esc(entry.metric)}</p></section><section class="detail-section"><h3>评测方式</h3><p>${esc(entry.method)}</p></section></div>
    <div class="use-heading"><h3 class="use-title">官方使用记录</h3><span>${rows.length} 条</span>${toggle}</div>${rows.map(u=>`<article class="use-row"><div>${badge(u.provider)}<strong>${esc(u.model)}</strong><time class="record-date" datetime="${u.date}">${u.date}</time></div><div class="use-result">${esc(u.result || '原文披露采用该评测，详见报告。')}</div>${visit(u.url,'官方原文','source-link')}</article>`).join('')}`;
  $('show-all')?.addEventListener('click',()=>{
    const before=dialogs.scrollTop;
    renderDetail(entry,!showAll);
    dialogs.scrollTop=before; $('show-all')?.focus({preventScroll:true});
  });
  if (!dialogs.open) dialogs.showModal();
  dialogs.scrollTop = 0;
}
function closeDetail() {
  if (history.state?.fromAtlas) history.back();
  else {
    const url = new URL(location.href);
    url.hash = view; url.searchParams.delete('view');
    history.replaceState(null,'',url);
    syncLocation();
  }
}
function syncLocation() {
  view = currentView();
  const params = parameters();
  for (const key of ['provider','year','category','query']) {
    const el = $(key), value = params.get(key) || '';
    el.value = el.tagName === 'SELECT' && ![...el.options].some(option=>option.value === value) ? '' : value;
  }
  for (const a of document.querySelectorAll('[data-view]')) {
    if (a.dataset.view === view) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  }
  $('browser').hidden = view === 'method';
  $('history-note').hidden = view !== 'timeline';
  $('method-view').hidden = view !== 'method';
  const id = detailId();
  const entry = entries.find(e=>e.id === id);
  renderResults();
  if (entry) renderDetail(entry);
  else if (dialogs.open) {
    dialogs.close();
    if (lastFocus) [...document.querySelectorAll('[data-entry]')].find(a=>a.dataset.entry===lastFocus)?.focus({preventScroll:true});
  }
}
function bind() {
  document.querySelector('.views').addEventListener('click', e=>{
    const a=e.target.closest('[data-view]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); limit=12; navigateView(a.dataset.view);
  });
  for (const key of ['provider','year','category','query']) $(key).addEventListener(key==='query'?'input':'change',applyFilterQuery);
  $('matrix').addEventListener('click', e=>{
    const cell=e.target.closest('button[data-v]');
    if (!cell) return;
    const url=new URL(location.href);
    url.search=''; url.searchParams.set('provider',cell.dataset.v); url.searchParams.set('year',cell.dataset.y); url.hash='catalog';
    history.pushState(null,'',url); limit=12; syncLocation(); $('workspace').scrollIntoView({block:'start'});
  });
  $('clear').addEventListener('click',()=>{
    for (const key of ['provider','year','category','query']) $(key).value='';
    applyFilterQuery();
  });
  $('more').addEventListener('click',()=>{limit+=12;renderResults()});
  $('browser').addEventListener('click',e=>{
    const a=e.target.closest('[data-entry]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); lastFocus=a.dataset.entry;
    history.pushState({fromAtlas:true},'',a.href); renderDetail(entries.find(entry=>entry.id===a.dataset.entry));
  });
  $('close').addEventListener('click',closeDetail);
  dialogs.addEventListener('cancel',e=>{e.preventDefault();closeDetail()});
  dialogs.addEventListener('click',e=>{
    if (e.target !== dialogs) return;
    const rect=dialogs.getBoundingClientRect();
    if(e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom) closeDetail();
  });
  window.addEventListener('popstate',syncLocation);
}
async function init() {
  const res=await fetch(new URL('records.json',import.meta.url));
  if (!res.ok) throw new Error('dataset');
  entries=await res.json();
  categories=unique(entries.map(e=>e.category)).sort((a,b)=>a.localeCompare(b,'zh'));
  for (const category of categories) $('category').add(new Option(category,category));
  const uses=entries.flatMap(e=>e.uses);
  $('total-bench').textContent=entries.length;
  $('total-uses').textContent=uses.length;
  $('total-report').textContent=unique(uses.map(u=>u.url.split('#')[0])).length;
  matrix(); bind(); syncLocation();
}
init().catch(()=>{
  $('result-count').textContent='资料读取失败';
  $('empty').hidden=false;
  $('empty').innerHTML='请刷新页面重试，或<a href="./records.json">直接查看完整数据</a>。';
});
