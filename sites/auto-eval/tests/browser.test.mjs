import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash as nodeHash } from 'node:crypto';
import { createHash } from '../cloud/browser-shims.mjs';
import { createPrivateApi } from '../cloud/runtime.mjs';
import { executeJob } from '../src/runner.mjs';
import edgeWorker from '../cloud/worker.mjs';

const seed=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function storage(){
  const tables={jobs:new Map(),datasets:new Map()};
  return {all:async key=>structuredClone([...tables[key].values()]),get:async(key,id)=>structuredClone(tables[key].get(id)),put:async(key,v)=>tables[key].set(v.id,structuredClone(v))};
}
function executionLocks(){
  return {busy:false,async request(name,options,callback){if(this.busy)return callback(null);this.busy=true;try{return await callback({name});}finally{this.busy=false;}}};
}
function spawn(){
  let current,dead=false;
  return {onmessage:null,onerror:null,terminate(){dead=true;},postMessage(data){
    if(data.type==='cancel'){current.cancelRequested=true;return;}
    current=structuredClone(data.job);
    executeJob(current,current.datasetSnapshot,{persist:async job=>{await sleep(1);if(!dead)this.onmessage({data:{type:'step',job:structuredClone(job)}});}})
      .then(job=>{if(!dead)this.onmessage({data:{type:'done',job:structuredClone(job)}});})
      .catch(()=>this.onerror?.({preventDefault(){}}));
  }};
}
const post=value=>({method:'POST',body:JSON.stringify(value)});
const input={datasetId:'retrieval-lab',maxExperiments:18};
async function waitDone(api,id){for(let n=0;n<150;n++){const job=await api('/api/jobs/'+id);if(job.status!=='running')return job;await sleep(5);}throw new Error('Job did not settle');}

test('browser SHA-256 exactly matches Node fingerprints for multilingual data',()=>{
  for(const value of ['', '评测🧪 browser',JSON.stringify(seed)])assert.equal(createHash('sha256').update(value).digest('hex'),nodeHash('sha256').update(value).digest('hex'));
});
test('browser runs actual metrics, exports locally, and persists across reloads without sharing visitors',async()=>{
  const store=storage(),locks=executionLocks();
  const api=await createPrivateApi({store,seed,locks,spawn});
  const created=await api('/api/jobs',post(input));
  const job=await waitDone(api,created.id);assert.equal(job.status,'completed');assert.ok(job.bestObjective>job.experiments[0].metrics.objective);assert.equal(job.holdout.best.recall,1);
  const exported=await api(`/api/jobs/${job.id}/export?format=md`);assert.ok(exported.content.includes(job.datasetHash));assert.equal(exported.type,'text/markdown');
  await sleep(3);
  const reloaded=await createPrivateApi({store,seed,locks,spawn});assert.equal((await reloaded('/api/jobs'))[0].status,'completed');
  const visitor=await createPrivateApi({store:storage(),seed,locks:executionLocks(),spawn});assert.deepEqual(await visitor('/api/jobs'),[]);
  const saved=await api('/api/datasets',post({...seed,name:'我的私有评估集'}));assert.notEqual(saved.id,seed.id);assert.equal((await visitor('/api/datasets')).length,1);
});
test('cross-tab execution lock rejects overlap; cancellation never reports completed holdout',async()=>{
  const store=storage(),locks=executionLocks(),api=await createPrivateApi({store,seed,locks,spawn});
  const job=await api('/api/jobs',post(input));
  const other=await createPrivateApi({store,seed,locks,spawn});
  await assert.rejects(other('/api/jobs',post(input)),/其他标签页/);
  await assert.rejects(other(`/api/jobs/${job.id}/cancel`,post({})),/启动实验/);
  await api(`/api/jobs/${job.id}/cancel`,post({}));const result=await waitDone(api,job.id);assert.equal(result.status,'cancelled');assert.equal(result.holdout,undefined);
});
test('an already-open second tab recovers an orphan after the running tab closes',async()=>{
  const store=storage(),locks=executionLocks();locks.busy=true;
  await store.put('jobs',{id:'orphan',name:'未完成',status:'running',createdAt:new Date().toISOString(),experiments:[],maxExperiments:18});
  const api=await createPrivateApi({store,seed,locks,spawn});assert.equal((await api('/api/jobs'))[0].status,'running');
  locks.busy=false;assert.equal((await api('/api/jobs'))[0].status,'interrupted');
});
test('spawn and storage failures do not leave an unending running state',async()=>{
  const store=storage(),locks=executionLocks();
  const api=await createPrivateApi({store,seed,locks,spawn(){throw new Error('Worker not supported');}});
  await assert.rejects(api('/api/jobs',post(input)),/Worker not supported/);assert.equal((await api('/api/jobs'))[0].status,'failed');assert.equal(locks.busy,false);
  const brokenStore=storage(),write=brokenStore.put;let writes=0;
  brokenStore.put=async(...args)=>{if(++writes>1)throw new Error('Quota');return write(...args);};
  const broken=await createPrivateApi({store:brokenStore,seed,locks:executionLocks(),spawn});
  const created=await broken('/api/jobs',post(input));const failed=await waitDone(broken,created.id);assert.equal(failed.status,'failed');assert.match(failed.error,/未能保存/);assert.equal(failed.holdout,undefined);
});
test('public Cloudflare APIs never expose browser jobs or accept writes',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('missing',{status:404})}};
  for(const pathname of ['/api/jobs','/api/jobs/private/export','/.env','/package.json'])assert.equal((await edgeWorker.fetch(new Request('https://autoeval.zhangmin.name'+pathname),env)).status,404);
  assert.equal((await edgeWorker.fetch(new Request('https://autoeval.zhangmin.name/api/jobs',{method:'POST',body:'{}'}),env)).status,405);
  const config=await (await edgeWorker.fetch(new Request('https://autoeval.zhangmin.name/api/config'),env)).json();assert.equal(config.providerConfigured,false);assert.equal(config.runtime,'browser');
});
