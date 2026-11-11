import { topicNames, topicDescriptions, escapeHTML as esc, filterVideos, sortVideos, relatedVideos, formatDuration, formatDate, formatViews, toggleItem, validatePreferences, sourceInfo } from './lib.js';

const $ = (s, root = document) => root.querySelector(s);
const icons = {
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 long:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m10 9 5 3-5 3z"/>',
 apps:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m14 18 3 3 5-6"/>',agent:'<rect x="4" y="6" width="16" height="14" rx="3"/><path d="M12 3v3M1 12h3m16 0h3M8 11h.1m7.9 0h.1M8 16h8"/>',
 evaluation:'<path d="M9 4h6M10 4v5l-6 10a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2L14 9V4M7.5 15h9"/>',
 like:'<path d="M7 10H3v11h4zm0 0 6-7c1.7 0 2 1.2 1.6 2.6L13.5 10H20a1 1 0 0 1 1 1.3l-2 8.4a1.7 1.7 0 0 1-1.7 1.3H7z"/>',
 dislike:'<g transform="rotate(180 12 12)"><path d="M7 10H3v11h4zm0 0 6-7c1.7 0 2 1.2 1.6 2.6L13.5 10H20a1 1 0 0 1 1 1.3l-2 8.4a1.7 1.7 0 0 1-1.7 1.3H7z"/></g>',
 history:'<path d="M3 11a9 9 0 1 1 2.4 7M3 5v6h6M12 7v5l3 2"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
 topics:'<rect x="3" y="3" width="7" height="7" rx=".5"/><rect x="14" y="3" width="7" height="7" rx=".5"/><rect x="3" y="14" width="7" height="7" rx=".5"/><rect x="14" y="14" width="7" height="7" rx=".5"/>',
 playlist:'<path d="M3 5h15M3 10h15M3 15h8M15 14l6 4-6 4z"/>',settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 3h4l.6 3 2 .9 2.8-.9 2 3.4-2.2 2 .1 2.2 2.1 2-2 3.4-2.8-.9-2 .9-.6 3h-4l-.6-3-2-.9-2.8.9-2-3.4 2.2-2-.1-2.2-2.1-2 2-3.4 2.8.9 2-.9z" transform="translate(0 -.5) scale(1 .96)"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',moon:'<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
 filter:'<path d="M3 6h6M13 6h8M3 12h12M19 12h2M3 18h2M9 18h12"/><circle cx="11" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
 check:'<path d="m5 12 4 4L20 5"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="m14 6-6 6 6 6"/>',external:'<path d="M14 3h7v7M21 3l-11 11M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',play:'<path d="m8 4 13 8-13 8z"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',shuffle:'<path d="M3 6h3c4 0 8 12 12 12h3M17 14l4 4-4 4M3 18h3c1.5 0 3-2 4.5-4M14 8c1.5-1 2.5-2 4-2h3m-4-4 4 4-4 4"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.topics}</svg>`;
// Retain the original key so existing local collections survive the rename.
const storageKey = 'hackertube-ai:v1';
const defaults = {liked:[],disliked:[],later:[],history:[],theme:'light',frames:true,hideSeen:false};
let prefs;
try { prefs = {...defaults, ...JSON.parse(localStorage.getItem(storageKey) || '{}')}; } catch { prefs = {...defaults}; }
for (const key of ['liked','disliked','later','history']) if (!Array.isArray(prefs[key])) prefs[key] = [];
let videos = [], catalog, commentsPromise, pageLimit = 24, renderToken = 0, filterOpen = false, toastTimer;
const main = $('#main');
const types = {talk:'技术演讲',lecture:'讲座',course:'系列课程',tutorial:'动手教程',interview:'技术访谈',demo:'演示',explainer:'原理讲解',documentary:'纪录片',commentary:'评析与评论',review:'应用实测',other:'其他'};
const levels = {intro:'入门',intermediate:'进阶',advanced:'深入',general:'通识'};
const topicOrder = Object.keys(topicNames);
const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch { toast('浏览器未允许保存，本次操作仍然有效'); } };
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'),2300); }
function applyTheme() {
  const dark = prefs.theme === 'dark' || prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#theme-toggle').setAttribute('aria-label',dark ? '切换浅色模式' : '切换深色模式');
  $('meta[name="theme-color"]').content = dark ? '#101010' : '#ffffff';
}
function readRoute() {
  const [raw, query = ''] = (location.hash.slice(1) || '/home').split('?');
  return {path:raw.replace(/\/$/,'') || '/home', params:Object.fromEntries(new URLSearchParams(query))};
}
function routeHref(path, params = {}) { const search = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== '' && v != null && v !== false)); return `#${path}${search.size ? '?' + search : ''}`; }
function changeParam(key,value) { const route = readRoute(); const params = {...route.params,[key]:value}; const hash = routeHref(route.path,params); if(location.hash === hash) render(); else location.hash = hash; }
function topicCount(id) { return videos.filter(v => v.topics.includes(id)).length; }
function sidebar(path) {
  const nav = (href,label,i,count,active) => `<a class="nav-link${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${count != null ? `<em>${count}</em>` : ''}</a>`;
  const channels = [['evaluation','模型评测','evaluation'],['ai-search','AI 搜索','search'],['app-evaluation','应用评测','apps'],['agent-evaluation','Agent 评测','agent']];
  const activeTopic = readRoute().params.topic;
  $('#sidebar').innerHTML = `<nav>${nav('#/home','精选推荐','home',null,path==='/home' && !channels.some(([id])=>id===activeTopic))}${channels.map(([id,label,i])=>nav(`#/home?topic=${id}`,label,i,topicCount(id),path==='/home'&&activeTopic===id)).join('')}${nav('#/longs','长视频','long',null,path==='/longs')}<hr class="nav-divider"><p class="nav-label">我的片单</p>${nav('#/liked','喜欢的视频','like',prefs.liked.length,path==='/liked')}${nav('#/later','稍后观看','clock',prefs.later.length,path==='/later')}${nav('#/history','观看历史','history',null,path==='/history')}<hr class="nav-divider">${nav('#/topics','全部主题','topics',null,path==='/topics')}${nav('#/playlists','主题片单','playlist',null,path==='/playlists'||path.startsWith('/collection/'))}${nav('#/settings','设置','settings',null,path==='/settings')}</nav><div class="side-note"><span class="dot"></span><b>少一点噪音，多一点理解。</b><br>灵感来自 <a href="https://hackertube.org/" target="_blank" rel="noopener noreferrer">HackerTube ↗</a><br><a href="#/about">数据来源与筛选说明</a></div>`;
}
function thumbSource(v) { return `https://i.ytimg.com/vi/${v.vid}/${prefs.frames ? 'hq2' : 'hqdefault'}.jpg`; }
function thumbnail(v, more = '') { return `<div class="thumbnail"><img src="${thumbSource(v)}" data-vid="${v.vid}" loading="lazy" alt="${esc(v.title)}">${v.duration_s ? `<span class="duration">${formatDuration(v.duration_s)}</span>` : ''}${more}</div>`; }
function sourceBadge(v) { const source=sourceInfo(v); return `<span class="hn-count ${source.kind==='curated'?'curated-source':''}" title="${esc(source.detail)}"><i>${source.kind==='curated'?'E':'Y'}</i>${esc(source.label)}</span>`; }
function card(v) {
  const saved = prefs.later.includes(v.vid);
  return `<article class="video-card" data-video="${v.vid}"><a class="video-link" href="#/watch/${v.vid}" title="${esc(v.selection_reason || v.why_hn)}">${thumbnail(v,prefs.history.includes(v.vid)?'<span class="seen-mark" title="已打开"></span>':'')}<div class="video-info"><h2 class="video-title">${esc(v.title)}</h2><p class="video-channel">${esc(v.channel)}</p></div></a><button class="later-button${saved ? ' saved' : ''}" data-later="${v.vid}" aria-label="${saved ? '移出稍后观看' : '加入稍后观看'}：${esc(v.title)}" title="${saved ? '移出稍后观看' : '稍后观看'}" aria-pressed="${saved}">${icon(saved?'check':'clock')}</button><div class="video-meta">${sourceBadge(v)}<span class="card-topic">${esc(topicNames[v.topics[0]] || '大模型')}${v.published ? ` · ${new Date(v.published).getUTCFullYear()}` : ''}</span></div></article>`;
}
function footer() { return `<footer class="footnote"><div class="footer-copy"><span class="tribute">致敬 <a href="https://hackertube.org/" target="_blank" rel="noopener noreferrer">Karpathy 的 HackerTube ↗</a></span><span>社区推荐与编辑精选 · 无需登录，收藏保存在当前浏览器</span></div><a href="#/about">了解数据与筛选标准 ↗</a></footer>`; }
function heading(title,description,kicker='THE SIGNAL, WITHOUT THE NOISE',extra='') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>${extra}</div>`; }
function empty(title,description,i='search',button=true) { return `<div class="empty"><div class="empty-icon">${icon(i)}</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${button ? '<a href="#/home" class="pill">浏览精选视频 '+icon('arrow')+'</a>' : ''}</div>`; }
function options(values,current,placeholder) { return `<option value="">${placeholder}</option>${Object.entries(values).map(([value,label])=>`<option value="${value}"${current === value ? ' selected' : ''}>${label}</option>`).join('')}`; }
function filterPanel(params) {
  return `<div class="filters" id="filter-panel"${filterOpen ? '' : ' hidden'}><label class="filter-field">视频时长<select id="duration-filter"${videos.some(v=>v.duration_s)?'':' disabled'}>${options({short:'20 分钟以内',medium:'20–60 分钟',long:'60 分钟以上'},params.duration,videos.some(v=>v.duration_s)?'不限时长':'暂无时长信息')}</select></label><label class="filter-field">内容形式<select id="type-filter">${options(Object.fromEntries(Object.entries(types).filter(([k])=>videos.some(v=>v.content_type===k))),params.type,'全部形式')}</select></label><label class="filter-field">内容难度<select id="level-filter">${options(levels,params.level,'全部难度')}</select></label><label class="check-field"><input type="checkbox" id="evergreen-filter"${params.evergreen ? ' checked' : ''}>只看长期有效的内容</label><label class="check-field"><input type="checkbox" id="seen-filter"${params.hideSeen ? ' checked' : ''}>隐藏已打开的视频</label><button class="text-button" id="reset-filters">重置筛选</button></div>`;
}
const playlists = [
  {id:'ai-search',title:'AI 搜索，答案从哪里来',desc:'检索、RAG 与搜索答案的质量评估。',pick:v=>v.topics.includes('ai-search')},
  {id:'app-evaluation',title:'AI 应用，真实用一遍',desc:'从具体任务和使用体验检验产品价值。',pick:v=>v.topics.includes('app-evaluation')},
  {id:'agent-evaluation',title:'Agent，任务做完了吗',desc:'观察任务完成、验证过程与失败边界。',pick:v=>v.topics.includes('agent-evaluation')},
  {id:'start',title:'从零理解大模型',desc:'先建立直觉，再走进模型内部。',pick:v=>v.topics.includes('llm')||v.topics.includes('architecture')},
  {id:'build',title:'亲手训练一个模型',desc:'分词、训练与代码实现，一步步拆开看。',pick:v=>v.topics.includes('training')},
  {id:'evaluate',title:'能力与边界，拿实验说话',desc:'模型的演示、测试和局限分析。',pick:v=>v.topics.includes('evaluation')},
  {id:'agents',title:'让模型真正做事',desc:'Agent、代码生成与工具调用。',pick:v=>v.topics.includes('agents')||v.topics.includes('inference')}
];
function listing(path,rawParams) {
  let params = {...rawParams}, source = videos, title = 'AI 评测与实践', desc = '大模型、AI 搜索、应用与 Agent，找到有依据的评测和实测。', kicker = 'AI EVALUATION × COMMUNITY PICKS', extra = `<span class="snapshot"><span></span>${videos.length} 条精选 · 本地收藏</span>`;
  if(path==='/home' && ['evaluation','ai-search','app-evaluation','agent-evaluation'].includes(params.topic)){title=topicNames[params.topic];desc=topicDescriptions[params.topic];}
  const savedKey = {'/liked':'liked','/later':'later','/history':'history'}[path];
  if (path === '/longs') { params.duration='long'; title='长视频，慢慢看'; desc=videos.some(v=>v.duration_s)?'一小时以上的课程与技术演讲，留一段完整的时间。':'当前数据未包含视频时长，可先浏览全部精选。'; }
  if (path === '/search') { title = rawParams.q ? `“${rawParams.q}” 的搜索结果` : '搜索视频'; desc='搜索标题、讲者、摘要与主题，支持常见中英文关键词。'; }
  if (savedKey) {
    const ids = prefs[savedKey].slice().reverse(); source = ids.map(id=>videos.find(v=>v.vid===id)).filter(Boolean);
    title = {liked:'喜欢的视频',later:'稍后观看',history:'观看历史'}[savedKey];
    desc = {liked:'值得再看一次的内容，留在这里。',later:'把想看的内容存下来，按自己的节奏探索。',history:'最近打开的视频。记录仅保存在当前浏览器。'}[savedKey];
    kicker='YOUR PERSONAL LIBRARY'; extra = savedKey==='history' && source.length ? '<button class="pill" id="clear-history">清空历史</button>' : '';
  }
  let collection;
  if (path.startsWith('/collection/')) {
    collection = playlists.find(p=>p.id===path.split('/')[2]);
    if(!collection) { main.innerHTML=empty('片单不存在','回到首页继续探索。'); return; }
    source=source.filter(collection.pick);title=collection.title;desc=collection.desc;kicker='A CURATED LEARNING PATH';
  }
  params.hideSeen = params.hideSeen === '1' || (!savedKey && prefs.hideSeen);
  params.evergreen = params.evergreen === '1'; params.hideDisliked = !savedKey;
  let found = filterVideos(source,params,prefs);
  if (!savedKey || rawParams.sort) found = sortVideos(found,params.sort||'recommended',prefs,videos);
  const showTopics = !savedKey && !collection;
  const activeFilter = ['duration','type','level','evergreen','hideSeen'].some(k=>!!params[k]);
  main.innerHTML = heading(title,desc,kicker,extra) + (showTopics ? `<nav class="topics" aria-label="视频主题"><a href="${routeHref(path,{...rawParams,topic:''})}" class="chip${!params.topic?' active':''}">全部精选</a>${topicOrder.filter(t=>topicCount(t)).map(t=>`<a href="${routeHref(path,{...rawParams,topic:t})}" class="chip${params.topic===t?' active':''}"${params.topic===t?' aria-current="true"':''}>${topicNames[t]}${['evaluation','ai-search','app-evaluation','agent-evaluation'].includes(t)?`<small>${topicCount(t)}</small>`:''}</a>`).join('')}</nav>` : '') + `<div class="toolbar"><div class="result-count"><b>${found.length}</b> 条视频${params.topic?' · '+esc(topicNames[params.topic]||params.topic):''}</div><div class="toolbar-actions"><select id="sort" aria-label="视频排序">${savedKey?`<option value=""${!rawParams.sort?' selected':''}>保存顺序</option>`:''}${[['recommended','精选排序'],['published','最近发布'],['recent','最近被推荐'],['duration','时长优先']].map(([v,n])=>`<option value="${v}"${(v==='duration'&&!videos.some(x=>x.duration_s)||v==='published'&&!videos.some(x=>x.published))?' disabled':''}${(rawParams.sort||(savedKey?'':'recommended'))===v?' selected':''}>${n}</option>`).join('')}</select><button class="filter-button${filterOpen?' active':''}" id="filter-button" aria-expanded="${filterOpen}" aria-controls="filter-panel">${icon('filter')}筛选${activeFilter?'<span class="filter-badge"></span>':''}</button></div></div>` + filterPanel(params) + (found.length ? `<div class="video-grid">${found.slice(0,pageLimit).map(card).join('')}</div>${found.length>pageLimit?`<div class="load-more"><button class="pill" id="load-more">再看 ${Math.min(24,found.length-pageLimit)} 条 ${icon('arrow')}</button></div>`:''}` : savedKey && !source.length ? empty({liked:'还没有喜欢的视频',later:'片单还是空的',history:'还没有观看记录'}[savedKey],{liked:'打开视频，点击“喜欢”，就能在这里找到它。',later:'点击视频右上角的时钟，把它留到有空的时候。',history:'打开任意视频后，这里会记录你的探索足迹。'}[savedKey],{liked:'like',later:'clock',history:'history'}[savedKey]) : empty(path==='/longs'&&!videos.some(v=>v.duration_s)?'当前未提供时长信息':'没有匹配的视频',path==='/longs'&&!videos.some(v=>v.duration_s)?'返回全部精选，即可继续浏览视频。':'试试更简短的关键词，或放宽筛选条件。','search',false)+`<div style="text-align:center"><button class="pill" id="empty-reset">清除筛选</button></div>`) + footer();
  $('#filter-button').onclick = () => { filterOpen=!filterOpen; $('#filter-panel').hidden=!filterOpen; $('#filter-button').classList.toggle('active',filterOpen); $('#filter-button').setAttribute('aria-expanded',String(filterOpen)); };
  $('#sort').onchange = e=>changeParam('sort',e.target.value);
  for (const key of ['duration','type','level']) $(`#${key}-filter`).onchange = e=>changeParam(key,e.target.value);
  $('#evergreen-filter').onchange=e=>changeParam('evergreen',e.target.checked?'1':'');
  $('#seen-filter').onchange=e=>{ if(prefs.hideSeen){prefs.hideSeen=false;save();} changeParam('hideSeen',e.target.checked?'1':''); };
  const reset=()=>{if(prefs.hideSeen){prefs.hideSeen=false;save();} location.hash=routeHref(path,{q:rawParams.q,topic:rawParams.topic}); render();};
  $('#reset-filters').onclick=reset; if($('#empty-reset')) $('#empty-reset').onclick=()=>{location.hash=routeHref(path==='/longs'?'/home':path);render();};
  if($('#load-more')) $('#load-more').onclick=()=>{const y=scrollY;pageLimit+=24;render(false);scrollTo(0,y);};
  if($('#clear-history')) $('#clear-history').onclick=()=>{prefs.history=[];save();render(false);toast('已清空观看历史');};
}
async function loadComments() { commentsPromise ??= fetch('./data/comments.json').then(r=>{if(!r.ok)throw new Error('comments');return r.json();}).catch(()=>null); return commentsPromise; }
function commentView(c) {
  const labels = {strong_rec:'强烈推荐',rec:'推荐',reference:'引用',critical:'批评',joke:'玩笑'};
  return `<article class="comment"><div class="comment-header"><b>@${esc(c.author||'HN user')}</b><span>${esc(String(c.ym||c.year||'').slice(0,4))}</span>${c.story?`<span>· ${esc(c.story)}</span>`:''}</div><p class="comment-text">${esc(c.text||'').replaceAll('[VIDEO]','[本视频]').replaceAll('[LINK]','[链接]')}</p><div class="comment-footer"><span class="stance ${esc(c.stance)}">${esc(labels[c.stance]||'讨论')}</span>${/^\d+$/.test(String(c.id))?`<a href="https://news.ycombinator.com/item?id=${c.id}" target="_blank" rel="noopener noreferrer">查看 HN 原帖 ↗</a>`:''}</div></article>`;
}
async function watchPage(id,token) {
  const v=videos.find(v=>v.vid===id);
  if(!v){main.innerHTML=empty('这个视频不在精选库中','本频道收录模型、AI 搜索、应用与 Agent 的评测和技术实践。');return;}
  prefs.history=[...prefs.history.filter(x=>x!==id),id].slice(-500);save();
  document.title=`${v.title} · EvalTube`;
  const provenance=sourceInfo(v);
  const sourceLine=provenance.kind==='curated'?`编辑精选 · ${provenance.detail}${provenance.verifiedAt?' · 核验于 '+provenance.verifiedAt:''}`:`${provenance.label} · ${provenance.detail}`;
  const commentsSection=provenance.kind==='curated'?`<section class="comments"><h2 class="section-label">来源与收录说明</h2><p class="section-note">${esc(provenance.detail)}${provenance.verifiedAt?' · 核验于 '+esc(provenance.verifiedAt):''}</p><p class="section-note">${esc(v.selection_reason)}</p>${provenance.url?`<a class="pill" href="${esc(provenance.url)}" target="_blank" rel="noopener noreferrer">查看原始来源 ${icon('external')}</a>`:''}</section>`:`<section class="comments"><h2 class="section-label">Hacker News 的推荐与讨论</h2><p class="section-note">保留原文与原帖链接，方便判断推荐依据。原始导出每条评论最多 1,500 字符。</p><div id="comments-content"><p class="section-note">正在加载评论…</p></div></section>`;
  const related=relatedVideos(v,videos.filter(x=>!prefs.disliked.includes(x.vid)));
  main.innerHTML = `<a href="#/home" class="breadcrumb">${icon('back')}返回精选</a><div class="watch-layout"><div class="watch-main"><div class="player" id="player"><button class="poster" id="play-video" aria-label="播放：${esc(v.title)}"><img src="${thumbSource(v)}" data-vid="${v.vid}" alt="${esc(v.title)}"><span class="play-circle">${icon('play')}</span></button></div><h1 class="watch-title">${esc(v.title)}</h1><div class="watch-owner"><div><p class="channel-name">${esc(v.channel)}</p><p class="subtext">${esc(sourceLine)}</p></div><div class="watch-actions"><button class="pill${prefs.liked.includes(id)?' active':''}" id="like" aria-pressed="${prefs.liked.includes(id)}">${icon('like')}喜欢</button><button class="pill${prefs.disliked.includes(id)?' active':''}" id="dislike" aria-label="不感兴趣，隐藏此视频" title="不感兴趣，隐藏此视频" aria-pressed="${prefs.disliked.includes(id)}">${icon('dislike')}</button><button class="pill${prefs.later.includes(id)?' active':''}" data-later="${id}" id="watch-later" aria-pressed="${prefs.later.includes(id)}">${icon(prefs.later.includes(id)?'check':'clock')}${prefs.later.includes(id)?'已保存':'稍后观看'}</button><a class="pill" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer">YouTube ${icon('external')}</a></div></div><div class="description"><div class="desc-meta">${[formatViews(v.views),formatDate(v.published),types[v.content_type]||v.content_type,levels[v.level]||'',v.shelf_life==='dated'?'历史版本评测':''].filter(Boolean).map(esc).join(' · ')}</div><p class="selection">入选理由 · ${esc(v.selection_reason||'大模型技术与能力分析')}</p><p>${esc(v.summary)}</p>${provenance.kind==='hacker-news' && v.why_hn?`<div class="why"><div class="why-label">${icon('like')}为什么 HN 在推荐</div><p>${esc(v.why_hn)}</p></div>`:''}<div class="tags">${v.topics.map(t=>`<a class="tag" href="#/home?topic=${t}">${esc(topicNames[t])}</a>`).join('')}${(v.tags||[]).map(t=>`<a class="tag" href="${routeHref('/search',{q:t})}">#${esc(t)}</a>`).join('')}</div></div>${commentsSection}</div><aside class="related"><h2>继续探索</h2><div class="related-list">${related.map(r=>`<a class="related-card" href="#/watch/${r.vid}">${thumbnail(r)}<div><h3>${esc(r.title)}</h3><p>${esc(r.channel)}</p><p>${esc(sourceInfo(r).label)}</p></div></a>`).join('')}</div></aside></div>`;
  $('#play-video').onclick=()=>{ $('#player').innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${esc(v.title)}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`; };
  const setVote=(key,other)=>{prefs[key]=toggleItem(prefs[key],id);prefs[other]=prefs[other].filter(x=>x!==id);save();for(const [selector,k]of[['#like','liked'],['#dislike','disliked']]){$(selector).classList.toggle('active',prefs[k].includes(id));$(selector).setAttribute('aria-pressed',String(prefs[k].includes(id)));}sidebar(readRoute().path);toast(key==='liked'?(prefs.liked.includes(id)?'已加入喜欢的视频':'已取消喜欢'):(prefs.disliked.includes(id)?'将从推荐中隐藏此视频':'已恢复推荐'));};
  $('#like').onclick=()=>setVote('liked','disliked');$('#dislike').onclick=()=>setVote('disliked','liked');
  if(provenance.kind==='curated')return;
  const comments=await loadComments(); if(token!==renderToken)return;
  let entries=comments?.[id] || comments?.comments?.[id] || [];
  if(!Array.isArray(entries))entries=[];
  $('#comments-content').innerHTML=entries.length?entries.map(commentView).join(''):v.quote?.text?`<article class="comment"><p class="comment-text">${esc(v.quote.text)}</p><div class="comment-footer"><span>${esc(v.quote.year||'')} · 原站精选评论</span><a href="https://news.ycombinator.com/item?id=${Number(v.quote.hn_comment_id||v.quote.id)||0}" target="_blank" rel="noopener noreferrer">查看 HN 原帖 ↗</a></div></article>`:'<p class="section-note">暂时没有可显示的评论，请通过原站查看。</p>';
}
function topicsPage(){main.innerHTML=heading('按主题探索','从模型、AI 搜索、应用和 Agent 的评测开始探索。','FIND YOUR NEXT RABBIT HOLE')+`<div class="topic-grid">${topicOrder.filter(t=>topicCount(t)).map((t,i)=>`<a class="topic-card" href="#/home?topic=${t}"><div class="topic-number">${String(i+1).padStart(2,'0')}${icon('arrow')}</div><h2>${topicNames[t]}</h2><p>${topicDescriptions[t]}</p><small>${topicCount(t)} 条精选视频</small></a>`).join('')}</div>`+footer();}
function playlistsPage(){main.innerHTML=heading('主题片单','从一个问题出发，顺着看下去。','FOLLOW YOUR CURIOSITY')+`<div class="playlist-grid">${playlists.map(p=>{const vs=sortVideos(videos.filter(p.pick));if(!vs.length)return '';return `<a class="playlist-card" href="#/collection/${p.id}"><div class="mosaic">${Array.from({length:4},(_,i)=>`<img src="${thumbSource(vs[i%vs.length])}" data-vid="${vs[i%vs.length].vid}" loading="lazy" alt="">`).join('')}<span>${icon('playlist').replace('<svg','<svg style="width:12px;height:12px;vertical-align:middle"')} ${vs.length} 条视频</span></div><h2>${p.title}</h2><p>${p.desc}</p></a>`;}).join('')}</div>`+footer();}
function settingsPage(){
  main.innerHTML=`<div class="reading-width">${heading('按你的习惯来','无需账户，这些偏好只属于当前浏览器。','MAKE YOURSELF AT HOME')}<div class="settings-list"><div class="setting"><div><h2>外观</h2><p>选择适合当前阅读环境的主题。</p></div><select id="theme-setting" aria-label="外观主题">${[['light','浅色'],['dark','深色'],['system','跟随系统']].map(([v,n])=>`<option value="${v}"${prefs.theme===v?' selected':''}>${n}</option>`).join('')}</select></div><div class="setting"><div><h2>使用视频中段画面</h2><p>用实际内容的一帧替代上传者设置的封面。</p></div><input class="toggle" type="checkbox" id="frames-setting" aria-label="使用视频中段画面"${prefs.frames?' checked':''}></div><div class="setting"><div><h2>隐藏已经打开的视频</h2><p>让精选推荐里更多地出现新内容。</p></div><input class="toggle" type="checkbox" id="hide-seen-setting" aria-label="隐藏已经打开的视频"${prefs.hideSeen?' checked':''}></div></div><p class="settings-note">喜欢、稍后观看和历史记录保存在本地。换浏览器前，可以先导出再导入。</p><div class="settings-buttons"><button class="pill" id="export-prefs">${icon('download')}导出我的收藏</button><button class="pill" id="import-prefs">导入收藏</button><input type="file" id="import-file" accept="application/json,.json" hidden></div></div>`;
  $('#theme-setting').onchange=e=>{prefs.theme=e.target.value;save();applyTheme();};
  $('#frames-setting').onchange=e=>{prefs.frames=e.target.checked;save();toast(prefs.frames?'已使用视频中段画面':'已使用视频原始封面');};
  $('#hide-seen-setting').onchange=e=>{prefs.hideSeen=e.target.checked;save();};
  $('#export-prefs').onclick=()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),preferences:Object.fromEntries(['liked','disliked','later','history'].map(k=>[k,prefs[k]]))},null,2)],{type:'application/json'}));a.href=url;a.download='evaltube-collection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('收藏已导出');};
  $('#import-prefs').onclick=()=>$('#import-file').click();
  $('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('收藏文件过大');const clean=validatePreferences(JSON.parse(await file.text()),new Set(videos.map(v=>v.vid)));for(const key of Object.keys(clean))prefs[key]=[...new Set([...prefs[key],...clean[key]])].slice(-500);prefs.disliked=prefs.disliked.filter(id=>!prefs.liked.includes(id));save();sidebar('/settings');toast('收藏已合并到当前浏览器');}catch(error){toast(error.message||'无法读取收藏文件');}e.target.value='';};
}
function aboutPage(){
  const mentions=videos.reduce((n,v)=>n+(v.hn?.mentions||0),0);
  const sourceCount=catalog.meta.totalSourceVideos||6454;
  const curatedCount=videos.filter(v=>sourceInfo(v).kind==='curated').length;
  const hnCount=videos.length-curatedCount;
  main.innerHTML=`<div class="reading-width">${heading('好内容，要看得见依据','模型、AI 搜索、应用与 Agent 的评测和实践精选。','ABOUT EVALTUBE')}<div class="stat-grid"><div class="stat"><strong>${sourceCount.toLocaleString('zh-CN')}</strong><span>HN 原库视频候选</span></div><div class="stat"><strong>${videos.length}</strong><span>评测与实践精选</span></div><div class="stat"><strong>${mentions.toLocaleString('zh-CN')}</strong><span>原库记录的 HN 提及</span></div></div><div class="prose"><p>EvalTube 的灵感来自 Andrej Karpathy 的 <a href="https://hackertube.org/" target="_blank" rel="noopener noreferrer">HackerTube</a>。频道保留社区的长期推荐，也补充有明确原始来源的编辑精选。目前有 ${hnCount} 条来自 HN 原库，${curatedCount} 条来自补充精选；每条视频都保留入选理由和对应来源。</p><h2>四个评测频道</h2><ul class="rule-list"><li><b>模型评测：</b>模型行为、能力实验、红队与局限分析。</li><li><b>AI 搜索：</b>搜索与 RAG 系统，检索相关性、答案正确性、引用和幻觉评估。</li><li><b>应用评测：</b>AI 产品、插件和助手在真实工作流里的体验、效果与失败案例。工作流演示会保留“演示”标记。</li><li><b>Agent 评测：</b>具体任务完成、代码验证、可靠性实验和能力宣称核验。Agent 架构教程另归“Agent 技术”。</li></ul><p>同时保留大模型架构、训练与对齐、推理和多模态基础。主题可以交叉归类。纯营销发布、泛科技访谈、无关产品评测与 AI 娱乐作品不会仅凭关键词入选。</p><h2>如何看待评测证据</h2><p>“评测”涵盖具体能力实验、任务观察和效果研究，不意味着每条视频都有标准化 benchmark。“AI 搜索”也包含检索与 RAG 的评估方法。请结合详情页的内容形式、入选理由和原始来源判断适用范围。</p><h2>推荐与来源标记</h2><p>标为“HN”的视频保留原库推荐人数、提及与真实评论，排序以原站推荐分为基础。“编辑精选”提供发布者、核验日期和来源链接，独立收录。你喜欢的主题会获得少量排序加权，不喜欢的视频会从推荐中隐藏。收藏与历史保存在当前浏览器。</p><h2>数据与归属</h2><p>HN 视频与评论来自 <a href="https://hackertube.org/download/videos.jsonl" target="_blank" rel="noopener noreferrer">HackerTube 开放视频清单</a> 及评论导出，上游为 <a href="https://huggingface.co/datasets/open-index/hacker-news" target="_blank" rel="noopener noreferrer">open-index/hacker-news</a>。这部分开放数据遵循 <a href="https://opendatacommons.org/licenses/by/1-0/" target="_blank" rel="noopener noreferrer">ODC-By 1.0</a>，详见 <a href="https://hackertube.org/download/DATA.md" target="_blank" rel="noopener noreferrer">原站数据说明</a>。原库摘要和推荐标签由 HackerTube 生成，HN 评论保留原文。补充精选的摘要由本频道编辑整理，视频内容属于各自发布者。</p><p>本地快照取得于 ${formatDate(catalog.meta.fetchedAt)||'本次构建'}${catalog.meta.sourceGeneratedAt?'；HN 上游导出于 '+formatDate(catalog.meta.sourceGeneratedAt):''}，不会在浏览时实时增加内容。编辑精选的核验日期单独记录。视频和缩略图由 YouTube 提供；受地区或发布者限制时，可使用详情页的原视频链接。</p><p><a href="./data/catalog.json" download>下载本频道视频清单 ↓</a></p></div></div>`+footer();
}
function bindImages(){document.querySelectorAll('img[data-vid]').forEach(img=>{img.onerror=()=>{if(img.src.includes('hq2.jpg'))img.src=`https://i.ytimg.com/vi/${img.dataset.vid}/hqdefault.jpg`;else{img.onerror=null;img.removeAttribute('src');img.alt='视频封面暂不可用';}};});}
async function render(resetScroll=true){
  if(!catalog)return;const token=++renderToken;const {path,params}=readRoute();
  document.title='EvalTube · AI 评测';$('#search').value=params.q||'';sidebar(path);document.body.classList.remove('mobile-open');$('#menu').setAttribute('aria-expanded',String(!matchMedia('(max-width:620px)').matches&&!document.body.classList.contains('collapsed')));
  if(resetScroll)scrollTo(0,0);
  try{if(path.startsWith('/watch/'))await watchPage(path.split('/')[2],token);else if(path==='/topics')topicsPage();else if(path==='/playlists')playlistsPage();else if(path==='/settings')settingsPage();else if(path==='/about')aboutPage();else if(['/home','/longs','/search','/liked','/later','/history'].includes(path)||path.startsWith('/collection/'))listing(path,params);else main.innerHTML=empty('页面不存在','回到精选，发现下一条好内容。');if(token===renderToken){if(!$('.footnote',main))main.insertAdjacentHTML('beforeend',footer());bindImages();}}catch(error){console.error(error);main.innerHTML=empty('页面暂时无法显示','请刷新页面重试。');}
}
$('#menu').innerHTML=icon('menu');$('#search-button').innerHTML=icon('search');$('#about-link').innerHTML=icon('info');applyTheme();
$('#menu').onclick=()=>{if(matchMedia('(max-width:620px)').matches){document.body.classList.toggle('mobile-open');$('#menu').setAttribute('aria-expanded',String(document.body.classList.contains('mobile-open')));}else{document.body.classList.toggle('collapsed');$('#menu').setAttribute('aria-expanded',String(!document.body.classList.contains('collapsed')));}};
$('#scrim').onclick=()=>{document.body.classList.remove('mobile-open');$('#menu').setAttribute('aria-expanded','false');};
$('.skip').onclick=e=>{e.preventDefault();main.focus();};
$('#theme-toggle').onclick=()=>{prefs.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();applyTheme();if(readRoute().path==='/settings')settingsPage();};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(prefs.theme==='system')applyTheme();});
$('#search-form').onsubmit=e=>{e.preventDefault();pageLimit=24;location.hash=routeHref('/search',{q:$('#search').value.trim()});if(readRoute().path==='/search')render();};
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}if(e.key==='Escape'){document.body.classList.remove('mobile-open');$('#search').blur();}});
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-later]');if(!button)return;
  e.preventDefault();const id=button.dataset.later;prefs.later=toggleItem(prefs.later,id);save();const on=prefs.later.includes(id);
  button.classList.toggle('saved',on);button.classList.toggle('active',on&&button.id==='watch-later');button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'移出稍后观看':'加入稍后观看');button.innerHTML=icon(on?'check':'clock')+(button.id==='watch-later'?(on?'已保存':'稍后观看'):'');sidebar(readRoute().path);if(readRoute().path==='/later')render(false);toast(on?'已加入稍后观看':'已移出稍后观看');
});
addEventListener('hashchange',()=>{pageLimit=24;render();});
async function init(){try{
  const response=await fetch('./data/catalog.json');if(!response.ok)throw new Error('catalog unavailable');catalog=await response.json();
  if(!Array.isArray(catalog.videos)||!catalog.videos.length)throw new Error('empty catalog');
  videos=catalog.videos.filter(v=>/^[\w-]{11}$/.test(v.vid)).map(v=>({...v,topics:v.topics||[]}));
  const ids=new Set(videos.map(v=>v.vid));for(const key of ['liked','disliked','later','history'])prefs[key]=prefs[key].filter(id=>ids.has(id));
  if(catalog.meta.metadataFile){try{const r=await fetch('./data/youtube-metadata.local.json');if(r.ok){const metadata=await r.json();const map=metadata.videos||metadata;videos=videos.map(v=>{const m=map[v.vid]||{};return {...v,duration_s:Number.isFinite(m.duration_s)?m.duration_s:null,published:typeof m.published==='string'?m.published:null,views:Number.isFinite(m.views)?m.views:null};});}}catch{}}
  await render();
}catch(error){console.error(error);main.innerHTML=empty('暂时无法加载视频库','请使用项目的本地服务打开页面，并确认 data/catalog.json 已生成。','info',false)+`<div style="text-align:center"><button class="pill" id="retry">重新加载</button></div>`;$('#retry').onclick=()=>location.reload();}}
init();
