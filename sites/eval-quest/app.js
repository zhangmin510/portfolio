var STORAGE_KEY = 'eval-quest-progress-v1';
var REGION_NAMES = ['评测的起源','可信的分数','走出实验室','会行动的机器'];
var REGION_MEDALS = ['量尺守护者','证据侦探','现实连接者','行动审计员'];
var ROUTES = {all:[1,2,3,4,5,6,7,8,9,10,11,12],project:[4,5,6,10,11],audit:[5,7,8,12],history:[1,2,3,9,12]};
var ROUTE_COPY = {all:'从量尺出发，走到会行动的机器。所有关卡始终开放。',project:'先定义目标，再检查样本与裁判，最后走完 RAG 与 Agent 项目。配合附录 B。',audit:'从差异是否可信，到排名、因果与前沿外推。配合附录 C 的证据台账。',history:'沿着原稿历史路线，认识量尺、实验、基准，再看跨行业与前沿。'};
var RELATIONS = [[1,6],[2,5],[4,10],[5,10],[6,12],[7,12],[8,11],[10,11]];
var state = freshState();
var currentPage = 'map';
var currentLab = 'paired';
var currentMission = null;
var currentDoc = null;
var currentLessonTab = 'learn';
var quizIndex = 0;
var zoom = 1;
var pan = {x:0,y:0};
var drag = null;
var toastTimer;
var searchTimer;
var noteTimer;
var storageWorks = true;
var lastFocused = null;

function $(id){return document.getElementById(id);}
function esc(s){return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pad(n){return String(n).padStart(2,'0');}
function freshState(){return {version:1,visited:[],passed:[],notes:{},selected:1,route:'all'};}
function questionKey(id,i){return id+':'+i;}
function completed(id){return MISSIONS[id-1].qs.every(function(q,i){return state.passed.includes(questionKey(id,i));});}
function completedCount(){return MISSIONS.filter(function(m){return completed(m.id);}).length;}
function totalXP(){return state.visited.length*10+state.passed.length*20;}
function level(){return Math.min(7,Math.floor(totalXP()/100)+1);}
function readState(value,strict){
 if(!value || typeof value!=='object' || value.version!==1)throw Error('不是兼容的 v1 存档');
 if(!Array.isArray(value.visited)||!Array.isArray(value.passed)||typeof value.notes!=='object'||value.notes===null||Array.isArray(value.notes))throw Error('存档字段不完整');
 var validKeys=MISSIONS.flatMap(function(m){return m.qs.map(function(q,i){return questionKey(m.id,i);});});
 if(strict && (value.visited.some(function(n){return !Number.isInteger(n)||n<1||n>12;}) || value.passed.some(function(k){return !validKeys.includes(k);})))throw Error('存档包含未知关卡或题目');
 var result=freshState();
 result.visited=Array.from(new Set(value.visited.filter(function(n){return Number.isInteger(n)&&n>=1&&n<=12;})));
 result.passed=Array.from(new Set(value.passed.filter(function(k){return validKeys.includes(k);})));
 result.passed.forEach(function(k){var id=Number(k.split(':')[0]);if(!result.visited.includes(id))result.visited.push(id);});
 for(var i=1;i<=12;i++){if(typeof value.notes[i]==='string')result.notes[i]=value.notes[i].slice(0,6000);}
 result.route=Object.prototype.hasOwnProperty.call(ROUTES,value.route)?value.route:'all';
 result.selected=Number.isInteger(value.selected)&&value.selected>=1&&value.selected<=12?value.selected:1;
 return result;
}
function saveState(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageWorks=true;}catch(e){storageWorks=false;}
 $('storageStatus').textContent=storageWorks?'进度仅保存在当前浏览器 · 不上传':'浏览器禁止持久存储 · 请导出存档保留进度';
}
function toast(msg){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').classList.add('show');toastTimer=setTimeout(function(){$('toast').classList.remove('show');},3600);}
function updateProgress(){
 var n=completedCount();$('heroCount').textContent=n;$('progressOrbit').style.background='conic-gradient(var(--accent) '+(n/12*360)+'deg,var(--border) 0)';
 $('heroStatus').textContent=n===12?'十二站，全部点亮':n===0?'旅程刚刚开始':'已点亮 '+n+' 种判断力';
 $('playerLevel').textContent='Lv. '+level();$('playerXP').textContent=totalXP()+' XP';
 $('resumeButton').textContent=n===12?'回顾你的旅程 →':state.visited.length?'继续探索 →':'开始探索 →';
}
function showPage(page,scroll){
 if(!['map','labs','library'].includes(page))return;
 currentPage=page;['map','labs','library'].forEach(function(p){$(p+'Page').hidden=p!==page;});
 document.querySelectorAll('[data-page]').forEach(function(b){b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
 if(page==='library')renderLibrary();
 if(scroll!==false)window.scrollTo({top:0,behavior:'instant'});
}
function setRoute(route){
 if(!Object.prototype.hasOwnProperty.call(ROUTES,route))return;
 state.route=route;
 document.querySelectorAll('[data-route]').forEach(function(b){var on=b.dataset.route===route;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 $('routeDescription').textContent=ROUTE_COPY[route];
 if(!ROUTES[route].includes(state.selected))state.selected=ROUTES[route][0];
 saveState();renderMap();renderMission();
}
function renderMap(){
 var route=ROUTES[state.route];
 var islands='<path class="island island-0" d="M37 83Q20 36 95 31L420 35Q475 36 481 99L480 258Q470 307 398 305L94 280Q35 260 37 215Z"/><path class="island island-1" d="M532 72Q542 29 610 29L908 36Q968 43 961 107L970 260Q948 303 862 303L586 291Q520 278 530 210Z"/><path class="island island-2" d="M35 391Q39 333 114 329L419 344Q482 351 480 410L463 580Q443 625 372 614L105 609Q29 589 35 538Z"/><path class="island island-3" d="M545 420Q550 371 615 371L888 384Q962 394 961 454L951 565Q935 610 871 613L602 599Q533 585 541 527Z"/>';
 var edges='';
 for(var i=0;i<route.length-1;i++){
  var a=MISSIONS[route[i]-1],b=MISSIONS[route[i+1]-1];
  var x1=a.x*10,y1=a.y*6.6,x2=b.x*10,y2=b.y*6.6;
  var mid=(x1+x2)/2;
  if(Math.abs(x2-x1)>400 && Math.abs(y2-y1)>150){edges+='<path class="path-line '+(state.route!=='all'?'route-active':'')+'" d="M'+x1+' '+y1+' C'+(x1-80)+' '+(y1+130)+' '+(x2+80)+' '+(y2-130)+' '+x2+' '+y2+'"/>';}
  else edges+='<path class="path-line '+(state.route!=='all'?'route-active':'')+'" d="M'+x1+' '+y1+' C'+mid+' '+y1+' '+mid+' '+y2+' '+x2+' '+y2+'"/>';
 }
 if($('linkToggle').checked){RELATIONS.filter(function(r){return r.includes(state.selected);}).forEach(function(r){var a=MISSIONS[r[0]-1],b=MISSIONS[r[1]-1];edges+='<path class="path-line relation" d="M'+a.x*10+' '+a.y*6.6+' Q500 340 '+b.x*10+' '+b.y*6.6+'"/>';});}
 $('mapSvg').innerHTML=islands+edges;
 $('nodeLayer').innerHTML=REGION_NAMES.map(function(region,idx){return '<div class="node-region"><p class="mobile-region-title">0'+(idx+1)+' / '+region+'</p>'+MISSIONS.filter(function(m){return m.region===idx;}).map(function(m){var done=completed(m.id),visited=state.visited.includes(m.id),sel=m.id===state.selected;return '<button id="node-'+m.id+'" class="map-node '+(sel?'selected ':'')+(done?'completed ':visited?'visited ':'')+(!route.includes(m.id)?'off-route':'')+'" style="left:'+m.x+'%;top:'+m.y+'%" data-mission="'+m.id+'" aria-label="第 '+m.id+' 关 '+m.name+'，'+(done?'已通关':visited?'已探索':'未探索')+'" aria-pressed="'+sel+'"><span class="pin">'+(done?'✓':pad(m.id))+'</span><span class="node-name">'+m.name+'</span><span class="node-tag">'+m.tag+'</span></button>';}).join('')+'</div>';}).join('');
}
function selectMission(id){
 if(!MISSIONS[id-1])return;state.selected=id;saveState();renderMap();renderMission();
 if(window.matchMedia('(max-width:700px)').matches)openLesson(id);
}
function renderMission(){
 var m=MISSIONS[state.selected-1],done=completed(m.id),visited=state.visited.includes(m.id);
 $('missionPanel').innerHTML='<div class="mission-overline"><p class="eyebrow">CHAPTER '+pad(m.id)+' / 12</p><span class="status-chip">'+(done?'✓ 已通关':visited?'探索中':'自由探索')+'</span></div><div class="mission-art" aria-hidden="true"><span>'+pad(m.id)+'</span><svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 54L33 17L64 47L106 13M10 54H110M33 17V54M64 47V54M106 13V54"/><circle cx="33" cy="17" r="5" fill="var(--surface)"/><circle cx="64" cy="47" r="5" fill="var(--surface)"/><circle cx="106" cy="13" r="5" fill="var(--surface)"/></svg></div><h2>'+m.name+'</h2><p class="hook">'+m.hook+'</p><p class="intro">'+m.intro+'</p><ul class="mission-goals">'+m.cards.map(function(c){return '<li>'+c[0]+'</li>';}).join('')+'</ul><button class="primary-btn" onclick="openLesson('+m.id+')">'+(done?'再探索一次':'进入这一关')+' <span>→</span></button><button class="text-btn" onclick="openLesson('+m.id+',\'original\')">阅读第 '+m.id+' 章原文</button><div class="mission-meta"><span>3 张知识卡 · 2 道情境题</span><span>最多 50 XP</span></div><div class="related-links" aria-label="关联关卡">'+m.related.slice(0,3).map(function(n){return '<button onclick="selectMission('+n+')">↗ '+MISSIONS[n-1].name+'</button>';}).join('')+'</div>';
}
function resumeJourney(){var route=ROUTES[state.route],next=route.find(function(n){return !completed(n);});openLesson(next||route[0]);}
function nextMission(){var route=ROUTES[state.route],i=route.indexOf(currentMission);var next=route.slice(Math.max(0,i+1)).find(function(n){return !completed(n);})||route.find(function(n){return !completed(n);});if(next)openLesson(next);else {closeLesson();showPassport();}}
function openLesson(id,tab){
 var m=MISSIONS[id-1];if(!m)return;
 flushNote();$('lessonContent').innerHTML='';
 if($('passportDialog').open)$('passportDialog').close();
 if(!$('lessonDialog').open)lastFocused=document.activeElement;
 currentMission=id;currentDoc=pad(id);state.selected=id;
 var first=!state.visited.includes(id);if(first)state.visited.push(id);
 saveState();updateProgress();renderMap();renderMission();
 $('lessonEyebrow').textContent='REGION 0'+(m.region+1)+' / '+REGION_NAMES[m.region]+' / +50 XP';
 $('lessonTitle').textContent=pad(id)+' · '+m.title;$('lessonSubtitle').textContent=m.hook;$('lessonTabs').hidden=false;
 quizIndex=m.qs.findIndex(function(q,i){return !state.passed.includes(questionKey(id,i));});if(quizIndex<0)quizIndex=0;
 if(!$('lessonDialog').open)$('lessonDialog').showModal();
 setLessonTab(tab||'learn');$('lessonDialog').scrollTop=0;
 if(first)toast('新地点已探索 · +10 XP');
}
function openReader(id){
 id=String(id).padStart(2,'0');if(!BOOK[id])return;
 if(Number(id)>=1&&Number(id)<=12){openLesson(Number(id),'original');return;}
 flushNote();$('lessonContent').innerHTML='';
 if($('passportDialog').open)$('passportDialog').close();
 currentMission=null;currentDoc=id;currentLessonTab='original';
 if(!$('lessonDialog').open)lastFocused=document.activeElement;
 $('lessonEyebrow').textContent='原稿快照 / DRAFT · PENDING';$('lessonTitle').textContent=BOOK[id].title;$('lessonSubtitle').textContent='保留原文、图版与引用；本次仅作互动转化，未新增事实审核。';$('lessonTabs').hidden=true;
 renderOriginal(id);if(!$('lessonDialog').open)$('lessonDialog').showModal();$('lessonDialog').scrollTop=0;
}
function closeLesson(){flushNote();$('lessonDialog').close();if(currentPage==='map'&&$('node-'+state.selected))$('node-'+state.selected).focus({preventScroll:true});else if(lastFocused&&lastFocused.isConnected)lastFocused.focus({preventScroll:true});}
function setLessonTab(tab){
 flushNote();currentLessonTab=tab;
 document.querySelectorAll('[data-lesson-tab]').forEach(function(b){var on=b.dataset.lessonTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 if(tab==='original'){renderOriginal(currentDoc);return;}
 if(!currentMission)return;
 if(tab==='challenge'){if(completed(currentMission))renderReward();else renderQuiz();return;}
 var m=MISSIONS[currentMission-1];
 $('lessonContent').innerHTML='<div class="learning-cards">'+m.cards.map(function(c,i){return '<article class="learning-card"><span class="card-no">FIELD NOTE / 0'+(i+1)+'</span><h3>'+c[0]+'</h3><p>'+c[1]+'</p><small>依据：第 '+m.id+' 章 '+c[2]+'</small></article>';}).join('')+'</div><div class="lesson-actions"><button class="primary-btn" onclick="setLessonTab(\'challenge\')">'+(completed(m.id)?'查看通关记录':'接受情境挑战')+' →</button>'+(m.lab?'<button class="outline-btn" onclick="openLab(\''+m.lab+'\')">去实验工坊亲手试试 ↗</button>':'<button class="outline-btn" onclick="setLessonTab(\'original\')">深入阅读原文 ↗</button>')+'</div><details class="method-note"><summary>展开本章原图 · 图 '+pad(m.figure)+' ＋</summary><figure class="lesson-figure"><img src="'+FIGURES[m.figure].src+'" alt="'+esc(FIGURES[m.figure].title)+'" loading="lazy"><figcaption>'+esc(FIGURES[m.figure].title)+' · 原稿图版；请结合原文图注理解假设与边界。</figcaption></figure></details><label class="reflection" for="reflectionNote">给未来的自己留一句话<span>如果有人拿一个高分说服你，这一关让你多问哪一个问题？自动保存到本机，最多 6,000 字符。</span><textarea id="reflectionNote" maxlength="6000" placeholder="我会先问……"></textarea></label>';
 $('reflectionNote').value=state.notes[currentMission]||'';
 $('reflectionNote').addEventListener('input',function(){clearTimeout(noteTimer);noteTimer=setTimeout(flushNote,350);});
}
function flushNote(){clearTimeout(noteTimer);if($('lessonDialog').open&&currentMission&&$('reflectionNote')){state.notes[currentMission]=$('reflectionNote').value;saveState();}}
function renderOriginal(id){
 var b=BOOK[id];if(!b)return;
 $('lessonContent').innerHTML='<div class="reader-meta"><span>书稿 '+esc(b.updated)+' · 教学草稿 · 待专题审读</span><a href="https://github.com/zhangmin510/portfolio/tree/main/sites/eval-quest" target="_blank" rel="noopener noreferrer">GitHub 源码 ↗</a><button class="text-btn" onclick="window.print()">打印当前章节</button></div><article class="reader-content">'+b.html+'</article>';
}
function openFigure(id){
 var f=FIGURES[id];if(!f)return;flushNote();currentMission=null;
 $('lessonEyebrow').textContent='原稿图版 / 教学图示';$('lessonTitle').textContent=f.title;
 $('lessonSubtitle').textContent='请结合原文图注理解证据身份、假设与限制。';$('lessonTabs').hidden=true;
 $('lessonContent').innerHTML='<figure class="lesson-figure"><img src="'+f.src+'" alt="'+esc(f.title)+'"></figure><button class="outline-btn" onclick="openReader(\''+(currentDoc||'94')+'\')">← 返回原文</button>';
 if(!$('lessonDialog').open)$('lessonDialog').showModal();$('lessonDialog').scrollTop=0;
}
function renderQuiz(){
 var m=MISSIONS[currentMission-1],q=m.qs[quizIndex],key=questionKey(m.id,quizIndex),passed=state.passed.includes(key);
 $('lessonContent').innerHTML='<div class="quiz-progress">'+m.qs.map(function(_,i){return '<span class="'+(state.passed.includes(questionKey(m.id,i))?'correct':'')+'"></span>';}).join('')+'情境挑战 '+(quizIndex+1)+' / '+m.qs.length+' · 每题首次答对 +20 XP</div><p class="quiz-question">'+q[0]+'</p><div class="quiz-options">'+q[1].map(function(opt,i){return '<button class="quiz-option '+(passed&&q[2]===i?'is-right':'')+'" data-answer="'+i+'" '+(passed?'disabled':'')+'><span>'+String.fromCharCode(65+i)+'</span>'+opt+'</button>';}).join('')+'</div><div id="quizFeedback" aria-live="polite">'+(passed?'<div class="quiz-feedback good"><strong>✓ 这道题已答对</strong>'+q[3]+'</div>':'')+'</div><div class="lesson-actions"><button class="outline-btn" onclick="setLessonTab(\'learn\')">← 回看知识卡</button><button id="quizNext" class="primary-btn" '+(!passed?'disabled':'')+' onclick="advanceQuiz()">'+(quizIndex===m.qs.length-1?'领取通关记录':'下一道题')+' →</button></div><p class="small muted">题目是依据本章设计的理解练习；答对不等于专业能力已获认证。允许重试，不扣分。</p>';
}
function answerQuiz(choice){
 var m=MISSIONS[currentMission-1],q=m.qs[quizIndex],key=questionKey(m.id,quizIndex);
 if(state.passed.includes(key))return;
 var right=choice===q[2],oldDone=completed(m.id);
 document.querySelectorAll('[data-answer]').forEach(function(b){b.classList.remove('is-wrong','is-right');});
 document.querySelector('[data-answer="'+choice+'"]').classList.add(right?'is-right':'is-wrong');
 $('quizFeedback').innerHTML='<div class="quiz-feedback '+(right?'good':'')+'"><strong>'+(right?'✓ 判断正确 · +20 XP':'还差一步，再检查证据的边界')+'</strong>'+q[3]+(right?'':' 你可以重新选择。')+'</div>';
 if(right){
  state.passed.push(key);saveState();updateProgress();renderMap();renderMission();
  document.querySelectorAll('[data-answer]').forEach(function(b){b.disabled=true;});$('quizNext').disabled=false;$('quizNext').focus({preventScroll:true});
  if(!oldDone&&completed(m.id))toast(completedCount()===12?'全图点亮！十二关已完成。':'关卡点亮：'+m.name+' · 本关累计 50 XP');
 }
}
function advanceQuiz(){var m=MISSIONS[currentMission-1];if(!state.passed.includes(questionKey(m.id,quizIndex)))return;if(quizIndex<m.qs.length-1){quizIndex++;renderQuiz();}else if(completed(m.id))renderReward();else{quizIndex=m.qs.findIndex(function(q,i){return !state.passed.includes(questionKey(m.id,i));});renderQuiz();}}
function renderReward(){var m=MISSIONS[currentMission-1];$('lessonContent').innerHTML='<div class="reward-panel"><div class="reward-seal" aria-hidden="true">✓</div><p class="eyebrow">CHAPTER COMPLETE / 50 XP</p><h3>'+m.name+'，已点亮。</h3><p>本关 2 道情境题已答对，3 张知识卡可随时回看。<br>下一次看到一个分数，带上这个新问题：<br><strong>'+m.hook+'</strong></p><button class="primary-btn" onclick="nextMission()">'+(completedCount()===12?'打开学习护照':'继续路线中的下一站')+' →</button><button class="outline-btn" onclick="quizIndex=0;renderQuiz()">回顾题目与解析</button></div><div class="related-links">'+m.related.map(function(n){return '<button onclick="openLesson('+n+')">关联探索：'+MISSIONS[n-1].name+' ↗</button>';}).join('')+'</div>';
}
function openLab(name){flushNote();if($('lessonDialog').open)$('lessonDialog').close();showPage('labs');selectLab(name);}
function selectLab(name){if(!['paired','judge','agent','release'].includes(name))return;currentLab=name;document.querySelectorAll('[data-lab]').forEach(function(b){b.classList.toggle('active',b.dataset.lab===name);b.setAttribute('aria-pressed',String(b.dataset.lab===name));});document.querySelectorAll('.lab').forEach(function(l){l.hidden=l.id!=='lab-'+name;});updateLab(name);}
function pct(x,d){return (x*100).toFixed(d===undefined?1:d)+'%';}
function fmt(x){return Number.isInteger(x)?String(x):x.toFixed(1);}
function stat(label,value,detail){return '<div class="lab-stat"><span>'+label+'</span><strong>'+value+'</strong><small>'+detail+'</small></div>';}
function pairedCalc(a,loss,gain,neither){var n=a+loss+gain+neither;if(n<=1)return null;var delta=(gain-loss)/n;var variance=Math.max(0,(gain+loss-n*delta*delta)/(n-1));var se=Math.sqrt(variance/n);return {n:n,a:(a+loss)/n,b:(a+gain)/n,delta:delta,se:se,lo:delta-1.96*se,hi:delta+1.96*se,discordant:gain+loss,degenerate:variance<1e-14};}
function judgeCalc(base,sens,spec){var tp=200*base*sens,fn=200*base*(1-sens),fp=200*(1-base)*(1-spec),tn=200*(1-base)*spec;return {tp:tp,fn:fn,fp:fp,tn:tn,accuracy:(tp+tn)/200,precision:tp+fp>1e-12?tp/(tp+fp):null};}
function agentCalc(p,k){return {any:1-Math.pow(1-p,k),all:Math.pow(p,k)};}
function updateLab(name){
 if(name==='paired'){
  var vals=['pairBoth','pairLoss','pairGain','pairNeither'].map(function(id){return $(id).value.trim()===''?NaN:Number($(id).value);}),threshold=Number($('pairThreshold').value);
  $('pairThresholdOut').textContent=threshold.toFixed(1)+' 点';
  if(vals.some(function(v){return !Number.isInteger(v)||v<0||v>100000;})){$('pairedResult').innerHTML='<p class="result-callout" role="alert">请输入 0 至 100,000 的整数题数；空值、负数与小数不能用于本例。</p>';return;}
  var r=pairedCalc.apply(null,vals);if(!r){$('pairedResult').innerHTML='<p class="result-callout" role="alert">至少需要两道题，才能计算样本方差。样本很小时仍不宜依赖正态近似。</p>';return;}
  var chartW=Math.max(250,Math.min(1000,$('pairedResult').clientWidth-16||550));
  var scaleMin=Math.floor(Math.min(-5,r.lo*100-3)/5)*5,scaleMax=Math.ceil(Math.max(15,r.hi*100+3,threshold+3)/5)*5;
  function cx(x){return 40+(x-scaleMin)/(scaleMax-scaleMin)*(chartW-75);}
  var svg='<svg viewBox="0 0 '+chartW+' 190" role="img" aria-label="配对净改善 '+(r.delta*100).toFixed(2)+' 个百分点，近似区间 '+(r.lo*100).toFixed(2)+' 到 '+(r.hi*100).toFixed(2)+' 点。门槛 '+threshold+' 点。"><line x1="40" x2="'+(chartW-35)+'" y1="126" y2="126" stroke="var(--border)"/>';
  for(var j=0;j<=4;j++){var v=scaleMin+(scaleMax-scaleMin)*j/4,x=cx(v);svg+='<line x1="'+x+'" x2="'+x+'" y1="121" y2="130" stroke="var(--border)"/><text x="'+x+'" y="151" text-anchor="middle">'+v.toFixed(1)+'</text>';}
  svg+='<line x1="'+cx(threshold)+'" x2="'+cx(threshold)+'" y1="45" y2="128" stroke="var(--warning)" stroke-dasharray="4 4"/><text x="'+cx(threshold)+'" y="29" text-anchor="middle">门槛 '+threshold+' 点</text><line x1="'+cx(r.lo*100)+'" x2="'+cx(r.hi*100)+'" y1="85" y2="85" stroke="var(--accent)" stroke-width="4"/><line x1="'+cx(r.lo*100)+'" x2="'+cx(r.lo*100)+'" y1="76" y2="94" stroke="var(--accent)" stroke-width="2"/><line x1="'+cx(r.hi*100)+'" x2="'+cx(r.hi*100)+'" y1="76" y2="94" stroke="var(--accent)" stroke-width="2"/><circle cx="'+cx(r.delta*100)+'" cy="85" r="7" fill="var(--accent)"/><text x="'+(chartW/2)+'" y="183" text-anchor="middle">净改善 / 百分点 · 近似 95% 区间</text></svg>';
  var reliable=!r.degenerate&&r.n>=30&&r.discordant>=10,pass=reliable&&r.lo*100>threshold;
  var msg=!reliable?'当前样本太少、分歧太少或方差退化。下面的数值是近似公式输出，不能视为可靠的风险保证或发布依据。':pass?'在当前近似与假设下，区间下界超过了设置的收益门槛。但这只检查了收益，还没有检查安全、成本与真实使用。':'点估计不等于足够证据。当前区间下界没有超过 '+threshold+' 点门槛；即使差异可能为正，也不能据此认定满足最小收益要求。';
  $('pairedResult').innerHTML='<div class="lab-stats">'+stat('A → B',pct(r.a)+' → '+pct(r.b),r.n+' 道同题')+stat('净改善',(r.delta*100).toFixed(2)+' 点','修复 '+vals[2]+' · 退步 '+vals[1])+'</div>'+svg+'<p class="small muted">近似 95% 区间：['+(r.lo*100).toFixed(2)+', '+(r.hi*100).toFixed(2)+'] 个百分点</p><div class="result-callout '+(pass?'success':'')+'">'+msg+'</div>';
 }
 if(name==='judge'){
  var base=Number($('judgeBase').value)/100,sens=Number($('judgeSensitivity').value)/100,spec=Number($('judgeSpecificity').value)/100;
  [['judgeBaseOut',base],['judgeSensitivityOut',sens],['judgeSpecificityOut',spec]].forEach(function(p){$(p[0]).textContent=pct(p[1],0);});var r=judgeCalc(base,sens,spec);
  $('judgeResult').innerHTML='<div class="lab-stats">'+stat('总准确率',pct(r.accuracy),'全部回答为分母')+stat('告警精确率',r.precision===null?'—':pct(r.precision),r.precision===null?'没有告警，无法定义':'所有被拦截回答为分母')+'</div><div class="confusion-grid"><div class="confusion-cell"><b>'+fmt(r.tp)+'</b><span>真阳 TP · 正确拦截问题</span></div><div class="confusion-cell error"><b>'+fmt(r.fp)+'</b><span>假阳 FP · 误拦合格答案</span></div><div class="confusion-cell error"><b>'+fmt(r.fn)+'</b><span>假阴 FN · 漏放不合格答案</span></div><div class="confusion-cell"><b>'+fmt(r.tn)+'</b><span>真阴 TN · 正确放行</span></div></div><div class="result-callout">'+(r.precision===null?'没有任何告警，告警精确率的分母为零，不能写成 100%。':'在 '+fmt(r.tp+r.fp)+' 条期望告警中，只有 '+fmt(r.tp)+' 条确实有问题。总准确率没有告诉你这些漏检与误拦的成本。')+'</div>';
 }
 if(name==='agent'){
  var p=Number($('agentP').value)/100,k=Number($('agentK').value),r=agentCalc(p,k);$('agentPOut').textContent=pct(p,0);$('agentKOut').textContent=k+' 次';
  $('agentResult').innerHTML='<div class="prob-block"><div class="prob-title"><span>至少一次成功 <small>pass@k · 搜索机会</small></span><b>'+pct(r.any)+'</b></div><div class="prob-track"><div class="prob-fill" style="width:'+r.any*100+'%"></div></div><small>1 − (1 − '+p.toFixed(2)+')<sup>'+k+'</sup></small></div><div class="prob-block"><div class="prob-title"><span>每一次都成功 <small>pass^k · 重复可靠性</small></span><b>'+pct(r.all)+'</b></div><div class="prob-track"><div class="prob-fill all" style="width:'+r.all*100+'%"></div></div><small>'+p.toFixed(2)+'<sup>'+k+'</sup></small></div><div class="trial-dots" aria-label="'+k+' 次尝试示意，非实测结果">'+Array.from({length:k},function(_,i){return '<span>'+(i+1)+'</span>';}).join('')+'</div><div class="result-callout">更多尝试扩大了“至少成功一次”的机会，却给“每次都成功”增加了要求。这里假设尝试独立，环境状态与成功概率不变。</div>';
 }
 if(name==='release'){
  var lower=Number($('releaseLower').value),latency=Number($('releaseLatency').value),cost=Number($('releaseCost').value),risk=$('releaseRisk').checked;
  $('releaseLowerOut').textContent=lower.toFixed(2)+' 点';$('releaseLatencyOut').textContent=latency.toFixed(1)+' 秒';$('releaseCostOut').textContent='$'+cost.toFixed(3);
  var gates=[[lower>3,'收益证据','区间下界 '+lower.toFixed(2)+' 点；要求严格超过 3 点'],[!risk,'权限底线',risk?'发现重大权限披露；不满足门禁':'本轮未发现预定义重大披露；不代表零风险'],[latency<=5,'延迟预算','p95 '+latency.toFixed(1)+' 秒；上限 5 秒'],[cost<=.03,'推理费用','$'+cost.toFixed(3)+' / 请求；上限 $0.030']];var pass=gates.every(function(g){return g[0];});
  $('releaseResult').innerHTML=gates.map(function(g){return '<div class="gate '+(g[0]?'passed':'')+'"><span>'+(g[0]?'✓':'×')+'</span><div><b>'+g[1]+'</b><small>'+g[2]+'</small></div></div>';}).join('')+'<div class="result-callout '+(pass?'success':'')+'"><strong>'+(pass?'四道教学门禁通过 → 进入受控试点':'暂不替换 A → 修复并重新确认')+'</strong><p>'+(pass?'这仅满足当前教学规则，不能跳过新的离线确认、真实人机协作验证和持续监控。':'总分、速度或价格上的优势，不能抵销未满足的收益要求与风险约束。')+'</p></div>';
 }
}
function resetLab(name){var defaults={paired:{pairBoth:240,pairLoss:40,pairGain:64,pairNeither:56,pairThreshold:3},judge:{judgeBase:20,judgeSensitivity:80,judgeSpecificity:90},agent:{agentP:80,agentK:3},release:{releaseLower:1.03,releaseLatency:4.1,releaseCost:.026}};Object.entries(defaults[name]).forEach(function(p){$(p[0]).value=p[1];});if(name==='release')$('releaseRisk').checked=true;updateLab(name);}
function renderLibrary(){
 var q=$('librarySearch').value.trim().toLocaleLowerCase();
 var docs=Object.keys(BOOK).sort().map(function(id){return BOOK[id];}).filter(function(b){return !q||(b.title+' '+b.summary+' '+b.text).toLocaleLowerCase().includes(q);});
 $('searchStatus').textContent=q?'找到 '+docs.length+' 篇匹配的原稿 · 搜索包含全部原文内容':'18 篇原稿 · 按原书顺序排列 · 支持全文检索';
 $('bookList').innerHTML=docs.length?docs.map(function(b){var match='';if(q){var at=b.text.toLocaleLowerCase().indexOf(q);if(at>=0)match=b.text.slice(Math.max(0,at-32),at+q.length+75).replace(/\s+/g,' ')+'…';}return '<button class="book-card" data-reader="'+b.id+'"><span class="book-id">'+(Number(b.id)>=1&&Number(b.id)<=12?'CHAPTER '+b.id:b.id==='00'?'START HERE':'APPENDIX / '+b.id)+'</span><b>'+esc(b.title)+'</b><small>'+esc(match||b.summary)+'</small></button>';}).join(''):'<div class="empty-state">没有找到相关原文。试试“配对”“权限”“校准”或“可靠性”。</div>';
 var terms=GLOSSARY.filter(function(t){return !q||t.join(' ').toLocaleLowerCase().includes(q);});
 $('glossary').innerHTML=terms.map(function(t){return '<details><summary>'+esc(t[0])+'</summary><p>'+esc(t[1])+'</p><p class="trap">不要误解成：'+esc(t[2])+'</p><button class="text-btn" onclick="openReader(\'90\')">查看附录 A 及依据 ↗</button></details>';}).join('')||'<p class="muted small">没有匹配的术语卡。</p>';
}
function showPassport(){
 flushNote();if($('lessonDialog').open)$('lessonDialog').close();
 renderPassport();if(!$('passportDialog').open)$('passportDialog').showModal();
}
function renderPassport(){
 $('passportContent').innerHTML='<div class="passport-statline"><div><strong>'+completedCount()+' / 12</strong><span>已通关地点</span></div><div><strong>'+state.passed.length+' / 24</strong><span>已答对情境题</span></div><div><strong>'+totalXP()+' XP</strong><span>Lv. '+level()+' · 学习进度</span></div></div><div class="medals">'+REGION_NAMES.map(function(name,i){var all=MISSIONS.filter(function(m){return m.region===i;}),n=all.filter(function(m){return completed(m.id);}).length;return '<div class="medal '+(n===all.length?'earned':'')+'"><b>'+(n===all.length?'✦':'◇')+'</b><span>'+REGION_MEDALS[i]+'</span><small>'+n+' / '+all.length+' 关 · '+name+'</small></div>';}).join('')+'</div><div class="passport-chapters">'+MISSIONS.map(function(m){return '<button onclick="openLesson('+m.id+')">'+pad(m.id)+' '+m.name+'<span>'+(completed(m.id)?'✓ 已通关':state.visited.includes(m.id)?'已探索':'未探索')+'</span></button>';}).join('')+'</div>';
}
function downloadBlob(content,type,name){var url=URL.createObjectURL(new Blob([content],{type:type}));var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},30000);}
function exportProgress(){flushNote();downloadBlob(JSON.stringify(Object.assign({},state,{exportedAt:new Date().toISOString()}),null,2),'application/json','eval-quest-progress.json');toast('存档已导出。请妥善保存其中的个人笔记。');}
function exportNotes(){flushNote();var text='# 评测探索局 · 学习笔记\n\n已探索 '+state.visited.length+' / 12 关；已通关 '+completedCount()+' / 12 关；'+totalXP()+' XP。\n\n> 学习进度不等于专业认证。以下为本人的学习摘记。\n';MISSIONS.forEach(function(m){text+='\n## '+pad(m.id)+' '+m.title+'\n\n状态：'+(completed(m.id)?'已通关':state.visited.includes(m.id)?'已探索':'未探索')+'\n\n'+(state.notes[m.id]||'（暂无摘记）')+'\n\n原稿：[第 '+m.id+' 章](https://zhangmin.name/panoramas/eval-quest/#book-'+pad(m.id)+')\n';});downloadBlob(text,'text/markdown;charset=utf-8','评测探索局-学习笔记.md');toast('学习笔记已导出。');}
async function importProgress(file){
 if(!file)return;
 try{if(file.size>500000)throw Error('文件过大，请选择本页面导出的存档');var imported=readState(JSON.parse(await file.text()),true);if(!confirm('导入会替换当前页面的学习进度与摘记。建议先导出当前存档。继续吗？'))return;state=imported;saveState();updateProgress();setRoute(state.route);renderPassport();toast('学习进度已恢复。');}
 catch(e){toast('未导入：'+e.message);}finally{$('importProgress').value='';}
}
function resetProgress(){if(!confirm('仅重置这份互动页面的进度和摘记，不会修改原始小册子。建议先导出存档。确认重置？'))return;state=freshState();saveState();updateProgress();setRoute('all');renderPassport();toast('进度已重置。原始小册子未改动。');}
function transformMap(){var f=$('mapFrame');var maxX=f.clientWidth*(zoom-1)/2,maxY=f.clientHeight*(zoom-1)/2;pan.x=Math.max(-maxX,Math.min(maxX,pan.x));pan.y=Math.max(-maxY,Math.min(maxY,pan.y));$('mapPlane').style.transform='translate('+pan.x+'px,'+pan.y+'px) scale('+zoom+')';$('zoomOut').disabled=zoom<=1;$('zoomIn').disabled=zoom>=1.8;}
function changeZoom(step){zoom=Math.max(1,Math.min(1.8,Math.round((zoom+step)*10)/10));transformMap();}
function onThemeChange(){}

try{var loaded=localStorage.getItem(STORAGE_KEY);if(loaded)state=readState(JSON.parse(loaded),false);}catch(e){if(e instanceof SyntaxError)toast('旧存档无法解析，已使用空白进度；可导入备份。');else storageWorks=false;}
updateProgress();setRoute(state.route);renderLibrary();['paired','judge','agent','release'].forEach(updateLab);transformMap();
document.querySelectorAll('[data-page]').forEach(function(b){b.addEventListener('click',function(){showPage(b.dataset.page);});});
document.querySelectorAll('[data-route]').forEach(function(b){b.addEventListener('click',function(){setRoute(b.dataset.route);});});
document.querySelectorAll('[data-lab]').forEach(function(b){b.addEventListener('click',function(){selectLab(b.dataset.lab);});});
document.querySelectorAll('[data-lesson-tab]').forEach(function(b){b.addEventListener('click',function(){setLessonTab(b.dataset.lessonTab);});});
$('nodeLayer').addEventListener('click',function(e){var b=e.target.closest('[data-mission]');if(b)selectMission(Number(b.dataset.mission));});
$('nodeLayer').addEventListener('dblclick',function(e){var b=e.target.closest('[data-mission]');if(b)openLesson(Number(b.dataset.mission));});
$('linkToggle').addEventListener('change',renderMap);
$('bookList').addEventListener('click',function(e){var b=e.target.closest('[data-reader]');if(b)openReader(b.dataset.reader);});
$('lessonContent').addEventListener('click',function(e){var b=e.target.closest('[data-answer]');if(b)answerQuiz(Number(b.dataset.answer));var a=e.target.closest('a[data-doc]');if(a){e.preventDefault();openReader(a.dataset.doc);}var f=e.target.closest('a[data-figure]');if(f){e.preventDefault();openFigure(Number(f.dataset.figure));}});
document.querySelectorAll('.lab input').forEach(function(el){el.addEventListener('input',function(){updateLab(el.closest('.lab').id.replace('lab-',''));});});
$('librarySearch').addEventListener('input',function(){clearTimeout(searchTimer);searchTimer=setTimeout(renderLibrary,100);});
$('importProgress').addEventListener('change',function(){importProgress(this.files[0]);});
$('lessonDialog').addEventListener('cancel',flushNote);
$('lessonDialog').addEventListener('close',function(){document.body.style.overflow='';});
$('lessonDialog').addEventListener('click',function(e){if(e.target===$('lessonDialog')){var r=this.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeLesson();}});
$('passportDialog').addEventListener('click',function(e){if(e.target===$('passportDialog')){var r=this.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.close();}});
$('zoomIn').addEventListener('click',function(){changeZoom(.2);});$('zoomOut').addEventListener('click',function(){changeZoom(-.2);});$('zoomFit').addEventListener('click',function(){zoom=1;pan={x:0,y:0};transformMap();});
$('mapFrame').addEventListener('pointerdown',function(e){if(zoom<=1||e.target.closest('button')||window.matchMedia('(max-width:700px)').matches)return;drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};this.setPointerCapture(e.pointerId);this.classList.add('dragging');});
$('mapFrame').addEventListener('pointermove',function(e){if(!drag)return;pan.x=drag.px+e.clientX-drag.x;pan.y=drag.py+e.clientY-drag.y;transformMap();});
['pointerup','pointercancel','lostpointercapture'].forEach(function(t){$('mapFrame').addEventListener(t,function(){drag=null;this.classList.remove('dragging');});});
window.addEventListener('resize',function(){transformMap();if(currentPage==='labs')updateLab(currentLab);});
window.addEventListener('pagehide',flushNote);
window.addEventListener('storage',function(e){if(e.key===STORAGE_KEY&&e.newValue){try{state=readState(JSON.parse(e.newValue),false);updateProgress();renderMap();renderMission();if($('passportDialog').open)renderPassport();}catch(_){}}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var dropdown=$('vizMenuDropdown');if(dropdown)dropdown.classList.remove('open');}});

function openHashTarget(){
 var match=/^#book-(\d{2})$/.exec(location.hash);
 if(match && BOOK[match[1]]){openReader(match[1]);return;}
 if(location.hash==='#map'){closeLesson();showPage('map');}
}
window.addEventListener('hashchange',openHashTarget);
openHashTarget();
