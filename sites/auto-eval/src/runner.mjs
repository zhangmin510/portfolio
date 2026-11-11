import { setImmediate as tick } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { evaluate, validateConfig, datasetHash, candidates } from './engine.mjs';

export async function proposeConfig(job, provider, fetcher=fetch, signal) {
  if(!provider.key||!provider.model)throw new Error('模型建议需要配置 AUTO_EVAL_API_KEY 和 AUTO_EVAL_MODEL');
  const response=await fetcher(provider.baseUrl.replace(/\/$/,'')+'/chat/completions',{
    method:'POST',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${provider.key}`},
    body:JSON.stringify({model:provider.model,max_tokens:400,messages:[
      {role:'system',content:'Suggest one BM25 retrieval configuration. Return ONLY a JSON object with tokenizer (words, mixed, or bigrams), chunkSize (80..1200 integer), overlap (0..min(120,chunkSize/2) integer), topK (1..5 integer), k1 (0.1..3), b (0..1). Maximize the provided tuning objective. Do not request or infer holdout results.'},
      {role:'user',content:JSON.stringify({objective:'0.7 recall + 0.3 MRR - contextPenalty * contextChars / 1000',contextPenalty:job.contextPenalty,bestConfig:job.bestConfig,experiments:job.experiments.slice(-8).map(e=>({config:e.config,metrics:{recall:e.metrics.recall,mrr:e.metrics.mrr,contextChars:e.metrics.contextChars,objective:e.metrics.objective}}))})}
    ]})
  });
  if(!response.ok)throw new Error(`模型服务返回 HTTP ${response.status}`);
  const data=await response.json(),text=data.choices?.[0]?.message?.content;
  if(typeof text!=='string')throw new Error('模型未返回配置文本');
  let parsed;try{parsed=JSON.parse(text.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw new Error('模型返回了无法解析的配置');}
  return {config:validateConfig(parsed),usage:{promptTokens:data.usage?.prompt_tokens??null,completionTokens:data.usage?.completion_tokens??null},model:provider.model};
}
export async function executeJob(job, dataset, {persist=async()=>{},provider={},fetcher=fetch,onStep,signal}={}) {
  const started=performance.now();
  const checkFrozen=()=>{if(datasetHash(dataset)!==job.datasetHash)throw new Error('数据集内容在实验期间发生变化');};
  const isCancelled=()=>job.cancelRequested||signal?.aborted;
  try{
    if(isCancelled())throw new Error('实验已停止');
    checkFrozen();
    const baseline=evaluate(dataset,job.baselineConfig,'tuning',job.contextPenalty);
    job.experiments.push({index:0,config:job.baselineConfig,metrics:baseline,decision:'baseline',elapsedMs:performance.now()-started});
    job.bestConfig={...job.baselineConfig};job.bestObjective=baseline.objective;await persist(job);await onStep?.(job);await tick();
    const queue=candidates(job.baselineConfig),seen=new Set([JSON.stringify(job.baselineConfig)]);
    for(let i=1;i<job.maxExperiments;i++){
      if(isCancelled()){job.status='cancelled';break;}
      checkFrozen();
      let config,proposal;
      if(job.strategy==='model'){
        proposal=await proposeConfig(job,provider,fetcher,signal);job.modelCalls++;
        if(isCancelled()){job.status='cancelled';break;}
        config=proposal.config;
        if(seen.has(JSON.stringify(config))){job.notes.push(`第 ${i} 次建议重复，跳过评估。`);await persist(job);await tick();continue;}
      }else config=queue.shift();
      if(!config)break;
      seen.add(JSON.stringify(config));
      const metrics=evaluate(dataset,config,'tuning',job.contextPenalty),keep=metrics.objective>job.bestObjective+1e-9;
      job.experiments.push({index:i,config,metrics,decision:keep?'keep':'revert',proposal:proposal?{model:proposal.model,usage:proposal.usage}:undefined,elapsedMs:performance.now()-started});
      if(keep){job.bestConfig={...config};job.bestObjective=metrics.objective;}
      await persist(job);await onStep?.(job);await tick();
    }
    if(isCancelled())job.status='cancelled';
    if(job.status==='running'){
      checkFrozen();
      // Evaluate holdout once, only after the tuning loop has fixed the best config.
      job.holdout={baseline:evaluate(dataset,job.baselineConfig,'holdout',job.contextPenalty),best:evaluate(dataset,job.bestConfig,'holdout',job.contextPenalty)};
      job.status='completed';
    }
  }catch(error){job.status=isCancelled()?'cancelled':'failed';if(job.status==='failed')job.error=error.message;else delete job.error;}
  job.finishedAt=new Date().toISOString();job.durationMs=performance.now()-started;await persist(job);return job;
}
