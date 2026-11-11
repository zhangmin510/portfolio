import { createServer } from 'node:http';
import { readFile,writeFile,mkdir,rename,readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateDataset,validateConfig,datasetHash,markdownReport } from './src/engine.mjs';
import { executeJob } from './src/runner.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
export async function createApp({runtime=path.join(root,'.runtime'),fetcher=fetch,provider={key:process.env.AUTO_EVAL_API_KEY,model:process.env.AUTO_EVAL_MODEL,baseUrl:process.env.AUTO_EVAL_BASE_URL||'https://openrouter.ai/api/v1'}}={}){
  const datasets=new Map(),jobs=new Map(),controllers=new Map();
  const seed=validateDataset(JSON.parse(await readFile(path.join(root,'data/demo.json'),'utf8')));datasets.set(seed.id,seed);
  await mkdir(path.join(runtime,'datasets'),{recursive:true});await mkdir(path.join(runtime,'jobs'),{recursive:true});
  const load=async(dir,fn)=>{for(const file of await readdir(path.join(runtime,dir))){if(!file.endsWith('.json'))continue;try{fn(JSON.parse(await readFile(path.join(runtime,dir,file),'utf8')));}catch{}}};
  await load('datasets',d=>{const validated=validateDataset(d);datasets.set(validated.id,validated);});
  await load('jobs',j=>{if(j.status==='running'){j.status='interrupted';j.error='服务重启前的实验未完成，可重新运行。';}jobs.set(j.id,j);});
  const persist=async job=>{const dest=path.join(runtime,'jobs',job.id+'.json');await writeFile(dest+'.tmp',JSON.stringify(job));await rename(dest+'.tmp',dest);};
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const body=async req=>{let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw new Error('请求不得超过 2MB');raw+=chunk;}try{return JSON.parse(raw);}catch{throw new Error('请输入有效 JSON');}};
  const summary=j=>({id:j.id,name:j.name,status:j.status,datasetName:j.datasetName,createdAt:j.createdAt,strategy:j.strategy,experiments:j.experiments.length,maxExperiments:j.maxExperiments,bestObjective:j.bestObjective??null,durationMs:j.durationMs??null});
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const host=(req.headers.host||'').replace(/:\d+$/,'');
      if(!['localhost','127.0.0.1','[::1]'].includes(host))return json(res,403,{error:'仅接受本机 Host'});
      if(url.pathname.startsWith('/api/')&&req.headers.origin){
        let origin;try{origin=new URL(req.headers.origin).origin;}catch{return json(res,403,{error:'仅接受同源页面请求'});}
        if(origin!==new URL(`http://${req.headers.host}`).origin)return json(res,403,{error:'仅接受同源页面请求'});
      }
      if(url.pathname.startsWith('/api/')&&req.method==='POST'&&!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'请使用 application/json 请求'});
      if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,{providerConfigured:Boolean(provider.key&&provider.model),model:provider.model||null,maxExperiments:36,version:'0.1.0'});
      if(url.pathname==='/api/datasets'&&req.method==='GET')return json(res,200,[...datasets.values()].map(d=>({id:d.id,name:d.name,description:d.description,origin:d.origin,documents:d.documents.length,tuning:d.queries.filter(q=>q.split==='tuning').length,holdout:d.queries.filter(q=>q.split==='holdout').length,hash:datasetHash(d)})));
      if(url.pathname==='/api/datasets'&&req.method==='POST'){
        const data=validateDataset(await body(req));data.id=randomUUID();datasets.set(data.id,data);await writeFile(path.join(runtime,'datasets',data.id+'.json'),JSON.stringify(data,null,2));return json(res,201,data);
      }
      if(url.pathname.startsWith('/api/datasets/')&&req.method==='GET'){const d=datasets.get(url.pathname.split('/')[3]);return d?json(res,200,d):json(res,404,{error:'数据集不存在'});}
      if(url.pathname==='/api/jobs'&&req.method==='GET')return json(res,200,[...jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(summary));
      if(url.pathname==='/api/jobs'&&req.method==='POST'){
        if([...jobs.values()].some(j=>j.status==='running'))return json(res,409,{error:'已有实验在运行，请等待完成或停止它'});
        const input=await body(req),dataset=datasets.get(input.datasetId);
        if(!dataset)throw new Error('请选择有效数据集');
        const strategy=input.strategy||'grid';if(!['grid','model'].includes(strategy))throw new Error('未知搜索策略');
        if(strategy==='model'&&!(provider.key&&provider.model))throw new Error('模型建议尚未配置，请设置服务端环境变量或选择本地候选搜索');
        const maxExperiments=input.maxExperiments??18;if(!Number.isInteger(maxExperiments)||maxExperiments<2||maxExperiments>36)throw new Error('实验预算应为 2–36 次（含基线）');
        const contextPenalty=input.contextPenalty??.02;if(!Number.isFinite(contextPenalty)||contextPenalty<0||contextPenalty>.5)throw new Error('上下文惩罚应在 0–0.5 之间');
        const job={id:randomUUID(),name:String(input.name||'RAG 检索配置实验').slice(0,100),datasetId:dataset.id,datasetName:dataset.name,datasetHash:datasetHash(dataset),datasetSnapshot:structuredClone(dataset),strategy,maxExperiments,contextPenalty,baselineConfig:validateConfig(input.baseline),status:'running',createdAt:new Date().toISOString(),experiments:[],notes:[],modelCalls:0};
        // Reserve the only execution slot synchronously after body parsing.
        if([...jobs.values()].some(j=>j.status==='running'))return json(res,409,{error:'已有实验在运行，请等待完成或停止它'});
        const controller=new AbortController();jobs.set(job.id,job);controllers.set(job.id,controller);
        try{await persist(job);}catch(error){jobs.delete(job.id);controllers.delete(job.id);throw error;}
        json(res,201,summary(job));
        setImmediate(()=>{executeJob(job,job.datasetSnapshot,{persist,provider,fetcher,signal:controller.signal}).catch(()=>{job.status='failed';job.error='无法保存实验状态';}).finally(()=>controllers.delete(job.id));});return;
      }
      const match=url.pathname.match(/^\/api\/jobs\/([\w-]+)(?:\/(cancel|export))?$/);
      if(match){const job=jobs.get(match[1]);if(!job)return json(res,404,{error:'实验不存在'});
        if(match[2]==='cancel'&&req.method==='POST'){job.cancelRequested=true;controllers.get(job.id)?.abort();return json(res,200,{status:job.status,cancelRequested:true});}
        if(match[2]==='export'&&req.method==='GET'){
          const markdown=url.searchParams.get('format')==='md';res.writeHead(200,{'Content-Type':markdown?'text/markdown; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="auto-eval-${job.id}.${markdown?'md':'json'}"`});res.end(markdown?markdownReport(job):JSON.stringify(job,null,2));return;
        }
        if(!match[2]&&req.method==='GET')return json(res,200,job);
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:'接口不存在'});
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'不支持该方法'});
      const base=path.join(root,'public'),file=path.resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(base+path.sep))return json(res,403,{error:'禁止访问'});
      const content=await readFile(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
    }catch(error){json(res,error.code==='ENOENT'?404:400,{error:error.code==='ENOENT'?'文件不存在':error.message});}
  });
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=await createApp();server.listen(Number(process.env.PORT||4324),'127.0.0.1',()=>console.log(`AutoEval → http://localhost:${process.env.PORT||4324}`));}
