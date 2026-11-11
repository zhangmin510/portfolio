export const topics = {
  models: { name:'模型评测', description:'能力、知识、事实性与可靠性', icon:'◎' },
  search: { name:'AI 搜索 / RAG', description:'检索、回答质量与引用验证', icon:'⌕' },
  apps: { name:'应用评测', description:'真实工作流与应用环境', icon:'▧' },
  agents: { name:'Agent 评测', description:'工具使用、多轮任务与完成质量', icon:'◇' }
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stopwords = new Set('a an the of for in to with and or on by from as at is are be we our this that through into using can large language models model benchmark evaluating evaluation'.split(' '));
export function tokenize(text) {
  const lowered=String(text||'').normalize('NFKC').toLowerCase();
  const english=(lowered.match(/[a-z0-9][a-z0-9-]{1,}/g)||[]).filter(t=>!stopwords.has(t));
  const chinese=lowered.match(/[\u4e00-\u9fff]+/g)||[];
  return [...english,...chinese.flatMap(s=>s.length<2?[s]:Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2)))];
}
export function paperText(paper) { return [paper.title,paper.shortTitle,paper.summary,...paper.keywords,...paper.topics.map(t=>topics[t]?.name||t)].join(' '); }
export function makeVectors(papers) {
  const docs=papers.map(p=>tokenize(paperText(p))),df=new Map();
  for(const doc of docs)for(const word of new Set(doc))df.set(word,(df.get(word)||0)+1);
  return new Map(papers.map((paper,i)=>{
    const counts=new Map();for(const word of docs[i])counts.set(word,(counts.get(word)||0)+1);
    const vector=new Map([...counts].map(([word,count])=>[word,(1+Math.log(count))*(Math.log((papers.length+1)/((df.get(word)||0)+1))+1)]));
    const length=Math.sqrt([...vector.values()].reduce((sum,n)=>sum+n*n,0));
    return [paper.id,new Map([...vector].map(([word,n])=>[word,length?n/length:0]))];
  }));
}
export function cosine(a,b) { if(!a||!b)return 0;let score=0;for(const [word,value]of a)score+=value*(b.get(word)||0);return Math.min(1,Math.max(0,score)); }
export function recommend(papers,preferences={},options={}) {
  const favorites=new Set(preferences.favorites||[]),ignored=new Set(preferences.ignored||[]),vectors=makeVectors(papers);
  const favoritePapers=papers.filter(p=>favorites.has(p.id));
  const selectedTopics=new Set(preferences.topics||[]);
  const hasProfile=favoritePapers.length>0||selectedTopics.size>0;
  return papers.filter(p=>options.includeIgnored||!ignored.has(p.id)).map(p=>{
    const similar=favoritePapers.filter(f=>f.id!==p.id).map(f=>({paper:f,score:cosine(vectors.get(p.id),vectors.get(f.id))})).sort((a,b)=>b.score-a.score)[0];
    const overlap=p.topics.filter(t=>selectedTopics.has(t));
    const score=(similar?.score||0)*.8+(overlap.length?Math.min(.2,overlap.length*.1):0);
    let reason='编辑整理的评测阅读起点';
    if(similar?.score>0)reason=`接近你收藏的 ${similar.paper.shortTitle}`;
    else if(overlap.length)reason=`匹配关注主题：${overlap.map(t=>topics[t].name).join('、')}`;
    if(favorites.has(p.id))reason='已在你的阅读清单';
    return {...p,recommendation:{score,reason,hasProfile}};
  }).sort((a,b)=>hasProfile?b.recommendation.score-a.recommendation.score||a.order-b.order:a.order-b.order);
}
const queryAliases={'智能体':'agent','搜索':'retrieval search rag','检索':'retrieval','事实':'factual','软件':'software','编程':'code software','工具':'tool','多模态':'multimodal','应用':'apps','幻觉':'hallucination','推理':'reasoning'};
export function matches(paper,query) {
  const haystack=[paperText(paper),...paper.authors].join(' ').toLowerCase();
  return String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean).every(term=>[term,...(queryAliases[term]?.split(' ')||[])].some(t=>t==='rag'?/(^|[^a-z])rag([^a-z]|$)/.test(haystack):haystack.includes(t)));
}
export function selectPapers(papers,preferences={},filters={}) {
  let result=recommend(papers,preferences,{includeIgnored:filters.view==='ignored'});
  if(filters.view==='saved')result=result.filter(p=>(preferences.favorites||[]).includes(p.id));
  if(filters.view==='ignored')result=result.filter(p=>(preferences.ignored||[]).includes(p.id));
  if(filters.topic)result=result.filter(p=>p.topics.includes(filters.topic));
  if(filters.query)result=result.filter(p=>matches(p,filters.query));
  if(filters.tag)result=result.filter(p=>(preferences.tags?.[p.id]||[]).includes(filters.tag));
  if(filters.sort==='newest')result.sort((a,b)=>b.published.localeCompare(a.published));
  if(filters.sort==='oldest')result.sort((a,b)=>a.published.localeCompare(b.published));
  if(filters.sort==='title')result.sort((a,b)=>a.shortTitle.localeCompare(b.shortTitle));
  return result;
}
export function similarPapers(paper,papers,limit=4) { const vectors=makeVectors(papers);return papers.filter(p=>p.id!==paper.id).map(p=>({...p,similarity:cosine(vectors.get(paper.id),vectors.get(p.id))})).sort((a,b)=>b.similarity-a.similarity||a.order-b.order).slice(0,limit); }
export function toggle(items,id) { return items.includes(id)?items.filter(x=>x!==id):[...items,id]; }
export function cleanPreferences(value,ids) {
  const input=value?.preferences||value||{};
  const clean={favorites:[],ignored:[],topics:[],tags:{}};
  for(const key of ['favorites','ignored'])clean[key]=[...new Set((Array.isArray(input[key])?input[key]:[]).filter(id=>ids.has(id)))];
  clean.ignored=clean.ignored.filter(id=>!clean.favorites.includes(id));
  clean.topics=[...new Set((Array.isArray(input.topics)?input.topics:[]).filter(id=>Object.hasOwn(topics,id)))];
  for(const [id,tags]of Object.entries(input.tags||{}))if(ids.has(id)&&Array.isArray(tags))clean.tags[id]=[...new Set(tags.filter(t=>typeof t==='string').map(t=>t.trim().slice(0,30)).filter(Boolean))].slice(0,12);
  return clean;
}
