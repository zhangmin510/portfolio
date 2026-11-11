import { createBrowserArchive } from './browser-archive.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
let browserArchive;
let config, claims = [], selected = null, editing = null, evidenceCounter = 0, requestVersion = 0, toastTimer;
const state = { asOf: '', topic: '', status: '', q: '', own: false, sort: 'newest' };
const statusTag = status => `<span class="status ${esc(status)}">${esc(config.statuses[status])}</span>`;
const displayDate = date => date.replaceAll('-', '.');
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'),2600); }
async function api(url, options = {}) {
  if (browserArchive && url !== '/api/config' && url !== '/api/seed') return browserArchive.request(url, options);
  const response = await fetch(url, { ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败');
  return result;
}
function params() { return new URLSearchParams(Object.entries(state).filter(([,value]) => value !== '' && value !== false)); }
function sourceLink(source) { return `<a class="source-link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.publisher)} · ${esc(source.title)} ↗</a>`; }
function renderTimeline() {
  $('#timeline').innerHTML = claims.length ? claims.map(c => `<article class="timeline-item"><div class="date-column"><strong>${c.date.slice(0,4)}</strong><span>${c.date.slice(5).replace('-',' / ')}</span><small>${c.origin === 'custom' ? '自建档案' : '来源已核对'}</small></div><div class="archive-card" tabindex="0" role="button" data-open="${esc(c.id)}" aria-label="查看档案：${esc(c.title)}"><div class="card-top"><span class="domain-label"><i></i>${esc(config.topics[c.topic])} / ${esc(c.organization)}</span>${statusTag(c.status)}</div><h3>${esc(c.title)}</h3><p class="claim-text">${esc(c.claim)}</p><div class="card-bottom"><span class="evidence-note"><b>${c.evidence.length}</b> 条证据${c.assessment ? ` · 人工判断 ${displayDate(c.assessment.date)}` : ' · 此时点尚无人工结论'}</span><span class="arrow" aria-hidden="true">↗</span></div></div></article>`).join('') : `<div class="empty"><h3>这一页时间，暂时没有记录。</h3><p>试试更晚的回看日期，或放宽搜索和筛选。</p><button class="outline" id="reset-filters">重置筛选</button></div>`;
  if ($('#reset-filters')) $('#reset-filters').onclick = () => { Object.assign(state, {topic:'',status:'',q:'',own:false}); syncControls(); refresh(); };
}
function syncControls() {
  $('#as-of').value = state.asOf; $('#search').value = state.q; $('#status').value = state.status; $('#own').checked = state.own; $('#sort').value = state.sort;
  $('#topics').innerHTML = [['','全部档案'], ...Object.entries(config.topics)].map(([id,label]) => `<button class="topic-button${state.topic === id ? ' active' : ''}" data-topic="${id}" aria-pressed="${state.topic === id}">${label}</button>`).join('');
  document.querySelectorAll('[data-date]').forEach(button => button.classList.toggle('active',(button.dataset.date === 'today' ? config.today : button.dataset.date) === state.asOf));
  $('.export-link').href = `/api/export?asOf=${state.asOf}`;
}
async function refresh() {
  const version = ++requestVersion;
  try {
    const result = await api(`/api/claims?${params()}`);
    if (version !== requestVersion) return;
    claims = result.claims;
    $('#claim-count').textContent = claims.length; $('#evidence-count').textContent = result.evidenceCount;
    $('#supported-count').textContent = claims.filter(c=>c.status==='supported').length; $('#pending-count').textContent = claims.filter(c=>c.status==='pending').length;
    $('#snapshot-note').textContent = `${displayDate(state.asOf)} · ${claims.length} / ${result.total} 条档案`;
    renderTimeline(); syncControls();
  } catch (error) { $('#timeline').innerHTML = `<div class="error-banner">${esc(error.message)} <button class="quiet" id="retry">重试</button></div>`; $('#retry').onclick=refresh; }
}
async function openDetail(id) {
  try {
    const {claim} = await api(`/api/claims/${encodeURIComponent(id)}?asOf=${state.asOf}`); selected = claim;
    const assessment = claim.assessment;
    $('#detail-content').innerHTML = `<div class="eyebrow">${esc(config.topics[claim.topic])} / ARCHIVE ${esc(claim.date.slice(0,4))}</div><h2>${esc(claim.title)}</h2><div class="detail-meta">${statusTag(claim.status)}<span>${esc(claim.organization)}</span><span>回看时点 ${displayDate(state.asOf)}</span></div><div class="original-claim"><div class="small-label">ORIGINAL CLAIM · ${displayDate(claim.date)}</div><p>${esc(claim.claim)}</p>${claim.scope?`<p class="scope-note">范围与条件：${esc(claim.scope)}</p>`:''}${sourceLink(claim.source)}</div><div class="detail-subhead"><h3>证据留下的轨迹</h3><span>${claim.evidence.length} 条 · 按发生时间排列</span></div><div>${claim.evidence.length ? claim.evidence.map(e=>`<article class="evidence-item"><div class="evidence-date">${displayDate(e.date)}<span class="relation ${e.relation}">${esc(config.relations[e.relation])}</span></div><h4>${esc(e.title)}</h4><p>${esc(e.summary)}</p>${sourceLink(e.source)}</article>`).join('') : '<p class="field-note">截至这个时点，档案中还没有后续证据。</p>'}</div><div class="detail-subhead"><h3>人工判断</h3><span>${assessment ? displayDate(assessment.date) : '此时点尚未形成'}</span></div><div class="assessment">${statusTag(claim.status)}<p>${esc(assessment?.summary || '尚待观察。当前回看时点没有已记录、且依据可见证据的人工判断。')}</p>${assessment?.caveat?`<p class="caveat">${esc(assessment.caveat)}</p>`:''}<small>${assessment ? esc(assessment.author)+' · '+displayDate(assessment.date)+' · '+assessment.basisEvidenceIds.length+' 条依据' : '人工判断独立记录日期，不会因今天的回顾改写过去。'}<br>这是编辑观点，不是模型自动裁决。</small></div><div class="detail-actions"><button class="outline" id="edit-selected"${state.asOf !== config.today ? ' disabled' : ''}>编辑这条档案</button><button class="outline" id="export-selected">导出此条 JSON</button></div>${state.asOf !== config.today ? '<p class="historical-note">正在查看历史快照，回到“最新”后可以编辑当前档案。</p>' : ''}<details class="history"><summary>编辑历史 <span id="history-count"></span></summary><div id="history-content">正在读取…</div></details>`;
    $('#edit-selected').onclick = () => { $('#detail-dialog').close(); openEditor(claim); };
    $('#export-selected').onclick = () => download({version:1,asOf:state.asOf,claims:[claim]},`capsule-${claim.id}.json`);
    if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
    const history = await api(`/api/claims/${encodeURIComponent(id)}/history?asOf=${state.asOf}`);
    if (selected?.id !== id) return;
    $('#history-count').textContent = `· ${history.revisions.length} 次`;
    $('#history-content').innerHTML = history.revisions.length ? history.revisions.slice().reverse().map(r=>`<div class="history-item"><b>${esc(new Date(r.savedAt).toLocaleString('zh-CN',{timeZone:'Asia/Singapore'}))}</b> · ${{create:'创建',edit:'编辑',import:'导入'}[r.action] || r.action}<br>${esc(r.current.title)} · ${r.current.evidence.length} 条证据${r.previous?`<details><summary>查看前一个版本</summary><p>${esc(r.previous.title)}<br>${esc(r.previous.claim)}</p></details>`:''}</div>`).join('') : '<p class="field-note">这个时点还没有本地编辑历史。首批资料是人工整理的种子快照。</p>';
  } catch(error) { toast(error.message); }
}
function download(data,filename) { const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function addEvidenceField(e = {}) {
  const key = `evidence-${++evidenceCounter}`;
  const article=document.createElement('div');article.className='evidence-fields';article.dataset.evidenceId=e.id||crypto.randomUUID();
  article.innerHTML=`<div class="evidence-row-head"><b>一条可核对的事实</b><button type="button" class="remove-evidence">移除</button></div><div class="form-grid"><label>证据日期<input type="date" data-field="date" required max="${config.today}" value="${esc(e.date||config.today)}"></label><label>与主张的关系<select data-field="relation">${Object.entries(config.relations).map(([id,label])=>`<option value="${id}"${id===(e.relation||'context')?' selected':''}>${label}</option>`).join('')}</select></label><label class="wide">证据标题<input data-field="title" maxlength="500" required value="${esc(e.title||'')}"></label><label class="wide">事实摘要<textarea data-field="summary" rows="3" maxlength="3000" required>${esc(e.summary||'')}</textarea></label><label>来源发布者<input data-field="publisher" required maxlength="200" value="${esc(e.source?.publisher||'')}"></label><label>来源标题<input data-field="sourceTitle" required maxlength="500" value="${esc(e.source?.title||e.title||'')}"></label><label class="wide">原始来源链接<input type="url" data-field="url" required placeholder="https://…" value="${esc(e.source?.url||'')}"></label></div>`;
  $('.remove-evidence',article).onclick=()=>article.remove();$('#evidence-fields').append(article);
}
function openEditor(claim = null) {
  editing=claim;const form=$('#claim-form');form.reset();$('#evidence-fields').innerHTML='';$('#form-error').textContent='';
  $('#edit-heading').textContent=claim?'编辑当前档案':'新建一条档案';
  const set=(name,value)=>form.elements[name].value=value||'';
  for(const name of ['id','title','topic','organization','date','claim','scope'])set(name,claim?.[name]||(name==='date'?config.today:name==='topic'?'models':''));
  set('publisher',claim?.source.publisher);set('sourceTitle',claim?.source.title);set('sourceUrl',claim?.source.url);
  set('assessmentStatus',claim?.assessment?.status||'pending');set('assessmentAuthor','本地编辑');set('assessmentSummary',claim?.assessment?.summary);set('assessmentCaveat',claim?.assessment?.caveat);
  form.elements.date.max=config.today;$('#assessment-date').textContent=displayDate(config.today);
  for(const e of claim?.evidence||[])addEvidenceField(e);
  $('#edit-dialog').showModal();
}
async function saveClaim(event) {
  event.preventDefault();const form=$('#claim-form');const data=new FormData(form);const get=name=>String(data.get(name)||'').trim();
  $('#form-error').textContent='';$('#save-button').disabled=true;
  try{
    const evidence=Array.from($('#evidence-fields').children).map(el=>{const value=name=>$(`[data-field="${name}"]`,el).value.trim();return{id:el.dataset.evidenceId,date:value('date'),relation:value('relation'),title:value('title'),summary:value('summary'),source:{publisher:value('publisher'),title:value('sourceTitle'),url:value('url'),date:value('date')}};});
    const record={id:editing?.id,title:get('title'),topic:get('topic'),organization:get('organization'),date:get('date'),claim:get('claim'),scope:get('scope'),source:{title:get('sourceTitle'),publisher:get('publisher'),url:get('sourceUrl'),date:get('date')},verifiedAt:config.today,evidence,assessments:[...(editing?.assessments||[]),{id:crypto.randomUUID(),date:config.today,status:get('assessmentStatus'),author:get('assessmentAuthor'),summary:get('assessmentSummary'),caveat:get('assessmentCaveat'),basisEvidenceIds:evidence.map(e=>e.id)}]};
    const result=await api(editing?`/api/claims/${encodeURIComponent(editing.id)}`:'/api/claims',{method:editing?'PUT':'POST',body:JSON.stringify(record)});
    $('#edit-dialog').close();state.asOf=config.today;await refresh();toast(browserArchive?'已保存到当前浏览器':'已保存到本地档案');await openDetail(result.claim.id);
  }catch(error){$('#form-error').textContent=error.message;}finally{$('#save-button').disabled=false;}
}
async function init(){
  try{
    config=await api('/api/config');
    if (config.storage === 'browser') {
      const seed = await api('/api/seed');
      const lock = action => navigator.locks ? navigator.locks.request('ai-time-capsule.archive.v1', action) : Promise.resolve().then(action);
      browserArchive = createBrowserArchive({ seed, storage: localStorage, lock });
      $('#storage-note').textContent='个人修改仅保存在当前浏览器，请定期导出 JSON 备份。';
      $('#storage-method').textContent='线上个人新增、编辑、导入与版本历史仅保存在当前浏览器。不会上传到 Cloudflare，也不会与其他访客共享。清除浏览器数据或更换设备无法自动找回，请定期使用“导出档案”备份。初始公开档案来自人工整理快照，无需模型 API。';
      $('.form-intro').textContent='把原始说法、事实证据与自己的判断分开记录。修改仅保存在当前浏览器。';
      $('#save-button').textContent='保存到当前浏览器';
      $('.export-link').onclick=async event=>{event.preventDefault();try{download(await api(`/api/export?asOf=${state.asOf}`),'ai-time-capsule.json');}catch(error){toast(error.message);}};
    }
    state.asOf=config.today;$('#as-of').max=config.today;$('#as-of').value=state.asOf;
    $('#status').innerHTML='<option value="">所有判断状态</option>'+Object.entries(config.statuses).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    $('#claim-form').elements.topic.innerHTML=Object.entries(config.topics).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    $('#claim-form').elements.assessmentStatus.innerHTML=Object.entries(config.statuses).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    $('#as-of').onchange=e=>{if(!e.target.value)return;state.asOf=e.target.value;refresh();};
    document.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{state.asOf=button.dataset.date==='today'?config.today:button.dataset.date;refresh();});
    $('#topics').onclick=e=>{const button=e.target.closest('[data-topic]');if(button){state.topic=button.dataset.topic;refresh();}};
    let debounce;$('#search').oninput=e=>{state.q=e.target.value;clearTimeout(debounce);debounce=setTimeout(refresh,160);};
    $('#status').onchange=e=>{state.status=e.target.value;refresh();};$('#own').onchange=e=>{state.own=e.target.checked;refresh();};$('#sort').onchange=e=>{state.sort=e.target.value;refresh();};
    $('#timeline').onclick=e=>{const card=e.target.closest('[data-open]');if(card)openDetail(card.dataset.open);};
    $('#timeline').onkeydown=e=>{const card=e.target.closest('[data-open]');if(card&&['Enter',' '].includes(e.key)){e.preventDefault();openDetail(card.dataset.open);}};
    $('#method-button').onclick=()=>$('#method-dialog').showModal();$('#new-button').onclick=()=>openEditor();$('#add-evidence').onclick=()=>addEvidenceField();$('#claim-form').onsubmit=saveClaim;
    document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>document.getElementById(button.dataset.close).close());
    document.querySelectorAll('dialog').forEach(dialog=>dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    $('#import-button').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('导入文件不能超过 2 MB');const payload=JSON.parse(await file.text());const result=await api('/api/import',{method:'POST',body:JSON.stringify(payload)});toast(`已验证并合并 ${result.imported} 条档案`);state.asOf=config.today;await refresh();$('#method-dialog').close();}catch(error){toast(error.message);}e.target.value='';};
    await refresh();
  }catch(error){$('#timeline').innerHTML=`<div class="error-banner">无法打开档案：${esc(error.message)}。请刷新页面重试。</div>`;}
}
init();
