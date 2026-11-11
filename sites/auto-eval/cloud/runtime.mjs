import { validateDataset, validateConfig, datasetHash, markdownReport } from '../src/engine.mjs';

const summary = job => ({ id:job.id, name:job.name, status:job.status, datasetName:job.datasetName, createdAt:job.createdAt, strategy:job.strategy, experiments:job.experiments.length, maxExperiments:job.maxExperiments, bestObjective:job.bestObjective??null, durationMs:job.durationMs??null });
const datasetSummary = dataset => ({ id:dataset.id, name:dataset.name, description:dataset.description, origin:dataset.origin, documents:dataset.documents.length, tuning:dataset.queries.filter(q=>q.split==='tuning').length, holdout:dataset.queries.filter(q=>q.split==='holdout').length, hash:datasetHash(dataset) });
const settings = { providerConfigured:false, model:null, maxExperiments:36, version:'0.2.0', runtime:'browser' };

export async function createPrivateApi({store, seed, spawn, locks=globalThis.navigator?.locks, uuid=()=>crypto.randomUUID()}) {
  seed = validateDataset(seed);
  if (!locks) throw new Error('当前浏览器不支持安全的多标签页实验协调，请更新浏览器');
  let active;
  const unsavedFailures=new Map();
  // A running record is interrupted only when no tab owns the execution lock.
  // Repeat on refresh so a tab already open can recover after the owner closes.
  const recoverOrphans=async()=>{
    if(active)return;
    await locks.request('autoeval-execution', {ifAvailable:true}, async lock => {
      if(!lock)return;
      for(const job of await store.all('jobs')) if(job.status==='running'){
        job.status='interrupted';job.error='页面关闭前的实验未完成，可重新运行。';
        await store.put('jobs',job);
      }
    });
  };
  await recoverOrphans();
  const datasets = async () => [seed, ...await store.all('datasets')];
  const findDataset = async id => id===seed.id ? seed : store.get('datasets', id);
  async function start(input) {
    return new Promise((resolve, reject) => {
      locks.request('autoeval-execution', {ifAvailable:true}, async lock => {
        if (!lock || active) { reject(new Error('已有实验在其他标签页运行，请等待或停止它')); return; }
        let worker, job;
        try {
          const dataset=await findDataset(input.datasetId);
          if (!dataset) throw new Error('请选择有效数据集');
          if ((input.strategy||'grid')!=='grid') throw new Error('在线版使用本地候选搜索，不调用模型 API');
          const budget=input.maxExperiments??18, penalty=input.contextPenalty??.02;
          if (!Number.isInteger(budget)||budget<2||budget>36) throw new Error('实验预算应为 2–36 次（含基线）');
          if (!Number.isFinite(penalty)||penalty<0||penalty>.5) throw new Error('上下文惩罚应在 0–0.5 之间');
          job={id:uuid(),name:String(input.name||'RAG 检索配置实验').slice(0,100),datasetId:dataset.id,datasetName:dataset.name,datasetHash:datasetHash(dataset),datasetSnapshot:structuredClone(dataset),strategy:'grid',maxExperiments:budget,contextPenalty:penalty,baselineConfig:validateConfig(input.baseline),status:'running',createdAt:new Date().toISOString(),experiments:[],notes:[],modelCalls:0};
          await store.put('jobs', job);
          worker=spawn(); active={id:job.id,worker};
          const finished = new Promise(accept => {
            let writes=Promise.resolve(), ended=false;
            const finish = () => { if(ended)return;ended=true;worker.terminate();active=null;accept(); };
            const fail = async message => {
              let latest=job;
              try { latest=await store.get('jobs',job.id)||job;latest.status='failed';latest.error=message;delete latest.holdout;await store.put('jobs',latest); }
              catch { latest={...latest,status:'failed',error:message+'；记录未能保存，请立即导出备份'};delete latest.holdout;unsavedFailures.set(job.id,latest); }
              finally { finish(); }
            };
            worker.onmessage=({data}) => {
              if (data.type==='step'||data.type==='done') {
                writes=writes.then(()=>store.put('jobs',data.job));
                if(data.type==='done') writes.then(finish,()=>fail('无法保存完整结果，请检查浏览器存储空间'));
                else writes.catch(()=>{});
              } else if(data.type==='error') writes.then(()=>fail(data.message),()=>fail('无法保存实验记录'));
            };
            worker.onerror=event => { event.preventDefault?.(); writes.then(()=>fail('实验计算发生错误，请重新运行'),()=>fail('无法保存实验记录')); };
          });
          worker.postMessage({type:'start',job}); resolve(summary(job));
          await finished;
        } catch(error) {
          worker?.terminate();active=null;
          if(job){job.status='failed';job.error='无法启动实验：'+error.message;try{await store.put('jobs',job);}catch{unsavedFailures.set(job.id,job);}}
          reject(error);
        }
      }).catch(reject);
    });
  }
  return async function api(path, options={}) {
    const url=new URL(path, 'https://autoeval.zhangmin.name'), method=options.method||'GET';
    const readBody=()=>{try { if((options.body?.length||0)>2_000_000)throw new Error();return JSON.parse(options.body||'{}'); }catch {throw new Error('请输入 2MB 以内的有效 JSON');}};
    if(url.pathname==='/api/config'&&method==='GET')return settings;
    if(url.pathname==='/api/datasets'&&method==='GET')return (await datasets()).map(datasetSummary);
    if(url.pathname==='/api/datasets'&&method==='POST'){
      const dataset=validateDataset(readBody());dataset.id=uuid();await store.put('datasets',dataset);return dataset;
    }
    if(url.pathname.startsWith('/api/datasets/')&&method==='GET'){
      const dataset=await findDataset(url.pathname.split('/')[3]);if(!dataset)throw new Error('数据集不存在');return dataset;
    }
    if(url.pathname==='/api/jobs'&&method==='GET'){
      await recoverOrphans();
      return (await store.all('jobs')).map(job=>unsavedFailures.get(job.id)||job).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(summary);
    }
    if(url.pathname==='/api/jobs'&&method==='POST')return start(readBody());
    const match=url.pathname.match(/^\/api\/jobs\/([\w-]+)(?:\/(cancel|export))?$/);
    if(match){
      const job=unsavedFailures.get(match[1])||await store.get('jobs',match[1]);if(!job)throw new Error('实验不存在');
      if(match[2]==='cancel'&&method==='POST'){
        if(active?.id!==job.id)throw new Error('请在启动实验的标签页停止它');
        active.worker.postMessage({type:'cancel'});return {status:job.status,cancelRequested:true};
      }
      if(match[2]==='export'&&method==='GET'){
        const md=url.searchParams.get('format')==='md';return {content:md?markdownReport(job):JSON.stringify(job,null,2),type:md?'text/markdown':'application/json',filename:`auto-eval-${job.id}.${md?'md':'json'}`};
      }
      if(!match[2]&&method==='GET')return job;
    }
    throw new Error('接口不存在');
  };
}
