import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const modes = new Set(['words', 'mixed', 'bigrams']);
export function validateDataset(input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) throw new Error('数据集需要 1–120 字的名称');
  if (!Array.isArray(input.documents) || input.documents.length < 2 || input.documents.length > 500) throw new Error('需要 2–500 篇文档');
  if (!Array.isArray(input.queries) || input.queries.length < 4 || input.queries.length > 200) throw new Error('需要 4–200 条查询，并包含调参与保留集');
  const ids = new Set();
  const documents = input.documents.map(d => {
    if (!d || typeof d.id !== 'string' || !/^[\w-]{1,80}$/.test(d.id) || ids.has(d.id)) throw new Error('文档 ID 必须唯一，且仅含字母、数字、横线或下划线');
    if (typeof d.title !== 'string' || typeof d.text !== 'string' || !d.title.trim() || !d.text.trim() || d.text.length > 50000 || d.title.length > 300) throw new Error('文档标题或正文不符合要求');
    ids.add(d.id); return { id: d.id, title: d.title, text: d.text };
  });
  const queryIds = new Set();
  const queries = input.queries.map(q => {
    if (!q || typeof q.id !== 'string' || !/^[\w-]{1,80}$/.test(q.id) || queryIds.has(q.id)) throw new Error('查询 ID 必须唯一且格式正确');
    if (typeof q.text !== 'string' || !q.text.trim() || q.text.length > 1000 || !['tuning','holdout'].includes(q.split)) throw new Error('每条查询需要问题和有效 split');
    if (!Array.isArray(q.relevantDocIds) || !q.relevantDocIds.length || q.relevantDocIds.some(id => !ids.has(id))) throw new Error('相关文档标注引用了未知 ID');
    queryIds.add(q.id); return { id: q.id, text: q.text, relevantDocIds: [...new Set(q.relevantDocIds)], split: q.split };
  });
  if (['tuning','holdout'].some(split => queries.filter(q => q.split === split).length < 2)) throw new Error('调参集和保留集分别至少需要两条查询');
  return { id: typeof input.id === 'string' && /^[\w-]+$/.test(input.id) ? input.id : undefined, name: input.name.trim(), description: String(input.description || '').slice(0,1200), origin: String(input.origin || '用户导入'), license: String(input.license || '用户提供'), documents, queries };
}
export function datasetHash(dataset) { return createHash('sha256').update(JSON.stringify({documents:dataset.documents,queries:dataset.queries})).digest('hex'); }
export function validateConfig(input = {}) {
  const c = { tokenizer: input.tokenizer ?? 'mixed', chunkSize: input.chunkSize ?? 280, overlap: input.overlap ?? 40, topK: input.topK ?? 1, k1: input.k1 ?? 1.2, b: input.b ?? .75 };
  if (!modes.has(c.tokenizer) || !Number.isInteger(c.chunkSize) || c.chunkSize < 80 || c.chunkSize > 1200 || !Number.isInteger(c.overlap) || c.overlap < 0 || c.overlap > Math.min(120,c.chunkSize/2) || !Number.isInteger(c.topK) || c.topK < 1 || c.topK > 5 || !Number.isFinite(c.k1) || c.k1 < .1 || c.k1 > 3 || !Number.isFinite(c.b) || c.b < 0 || c.b > 1) throw new Error('检索配置超出允许范围');
  return c;
}
export function tokenize(text, mode = 'mixed') {
  const s = text.normalize('NFKC').toLowerCase();
  if (mode === 'words') return s.split(/\s+/).filter(Boolean);
  const latin = s.match(/[a-z0-9]+/g) || [];
  const runs = s.match(/\p{Script=Han}+/gu) || [];
  return [...latin,...runs.flatMap(run => mode === 'bigrams' && run.length > 1 ? Array.from({length:run.length-1},(_,i)=>run.slice(i,i+2)) : [...run])];
}
export function buildIndex(documents, config) {
  const chunks = [];
  for (const document of documents) {
    const chars = [...document.text];
    for (let start=0; start<chars.length; start+=config.chunkSize-config.overlap) {
      const body=chars.slice(start,start+config.chunkSize).join('');
      const tokens=tokenize(document.title+' '+body,config.tokenizer);
      const frequency=new Map(); for(const token of tokens) frequency.set(token,(frequency.get(token)||0)+1);
      chunks.push({docId:document.id,title:document.title,text:body,start,length:tokens.length,frequency});
      if(start+config.chunkSize>=chars.length)break;
    }
  }
  const df=new Map();for(const chunk of chunks)for(const token of chunk.frequency.keys())df.set(token,(df.get(token)||0)+1);
  return {chunks,df,avgLength:chunks.reduce((n,c)=>n+c.length,0)/Math.max(chunks.length,1),config};
}
export function retrieve(index, query) {
  const terms=[...new Set(tokenize(query,index.config.tokenizer))];
  return index.chunks.map(chunk=>{
    let score=0;
    for(const term of terms){const tf=chunk.frequency.get(term)||0;if(!tf)continue;const count=index.df.get(term)||0;const idf=Math.log(1+(index.chunks.length-count+.5)/(count+.5));score+=idf*(tf*(index.config.k1+1))/(tf+index.config.k1*(1-index.config.b+index.config.b*chunk.length/Math.max(index.avgLength,1)));}
    return {docId:chunk.docId,title:chunk.title,text:chunk.text,start:chunk.start,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.docId.localeCompare(b.docId)||a.start-b.start).slice(0,index.config.topK);
}
export function evaluate(dataset, config, split='tuning', contextPenalty=.02) {
  const started=performance.now();
  const index=buildIndex(dataset.documents,config);
  const queries=dataset.queries.filter(q=>q.split===split);
  if(!queries.length)throw new Error('评估分区没有查询');
  const details=queries.map(q=>{
    const results=retrieve(index,q.text),relevant=new Set(q.relevantDocIds);
    const found=new Set(results.filter(r=>relevant.has(r.docId)).map(r=>r.docId));
    const first=results.findIndex(r=>relevant.has(r.docId));
    return {id:q.id,query:q.text,expected:q.relevantDocIds,results,recall:found.size/relevant.size,reciprocalRank:first<0?0:1/(first+1),contextChars:results.reduce((n,r)=>n+[...r.text].length,0)};
  });
  const avg=key=>details.reduce((n,x)=>n+x[key],0)/details.length;
  const recall=avg('recall'),mrr=avg('reciprocalRank'),contextChars=avg('contextChars');
  return {split,queries:queries.length,recall,mrr,contextChars,objective:.7*recall+.3*mrr-contextPenalty*contextChars/1000,durationMs:performance.now()-started,chunkCount:index.chunks.length,details};
}
export function candidates(baseline) {
  const result=[],seen=new Set([JSON.stringify(baseline)]);
  for(const topK of [2,3,1,4])for(const tokenizer of ['bigrams','mixed','words'])for(const chunkSize of [140,280,560]){
    const c=validateConfig({...baseline,topK,tokenizer,chunkSize,overlap:Math.min(40,chunkSize/2)}),key=JSON.stringify(c);
    if(!seen.has(key)){seen.add(key);result.push(c);}
  }
  return result;
}
export function markdownReport(job) {
  const pct=x=>x==null?'—':(x*100).toFixed(2)+'%';
  return `# AutoEval · ${job.name}\n\n- 状态：${job.status}\n- 数据集：${job.datasetName}\n- SHA-256：${job.datasetHash}\n- 策略：${job.strategy}\n- 目标：0.7 × Recall@k + 0.3 × MRR − ${job.contextPenalty} × 平均上下文千字符\n- 指标范围：检索相关性，不代表语言模型回答质量或真实业务成功率。\n\n| 实验 | 决定 | 目标值 | Recall | MRR | 上下文字符 |\n|---|---|---|---|---|---|\n${job.experiments.map(e=>`| ${e.index} | ${e.decision} | ${e.metrics.objective.toFixed(5)} | ${pct(e.metrics.recall)} | ${pct(e.metrics.mrr)} | ${e.metrics.contextChars.toFixed(0)} |`).join('\n')}\n\n## 最佳配置\n\n\`\`\`json\n${JSON.stringify(job.bestConfig,null,2)}\n\`\`\`\n\n## 保留集\n\n${job.holdout?`选定配置：Recall ${pct(job.holdout.best.recall)} / MRR ${pct(job.holdout.best.mrr)}\n基线配置：Recall ${pct(job.holdout.baseline.recall)} / MRR ${pct(job.holdout.baseline.mrr)}`:'尚未执行；保留集不参与配置选择。'}\n`;
}
