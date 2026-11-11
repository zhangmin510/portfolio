import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDataset,validateConfig,datasetHash,tokenize,buildIndex,retrieve,evaluate,candidates,markdownReport} from '../src/engine.mjs';
import {executeJob,proposeConfig} from '../src/runner.mjs';
const source=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url)));
const fresh=()=>validateDataset(structuredClone(source));
const jobFor=d=>({id:'test-job',name:'test',datasetName:d.name,datasetHash:datasetHash(d),strategy:'grid',maxExperiments:8,contextPenalty:.02,baselineConfig:validateConfig(),status:'running',experiments:[],notes:[],modelCalls:0});

test('dataset validation rejects duplicate IDs, dangling labels and missing holdout',()=>{
  const d=fresh();assert.equal(d.documents.length,12);assert.equal(d.queries.length,18);
  const duplicate=fresh();duplicate.documents[1].id=duplicate.documents[0].id;assert.throws(()=>validateDataset(duplicate),/ID/);
  const dangling=fresh();dangling.queries[0].relevantDocIds=['unknown'];assert.throws(()=>validateDataset(dangling),/未知/);
  const noHoldout=fresh();noHoldout.queries=noHoldout.queries.filter(q=>q.split==='tuning');assert.throws(()=>validateDataset(noHoldout),/保留集/);
});
test('content hash changes with text or relevance labels but not a display name',()=>{
  const a=fresh(),hash=datasetHash(a);a.name='new name';assert.equal(datasetHash(a),hash);
  a.documents[0].text+='changed';assert.notEqual(datasetHash(a),hash);
  const b=fresh();b.queries[0].relevantDocIds=['bm25'];assert.notEqual(datasetHash(b),hash);
});
test('configuration validation bounds every model-controlled parameter',()=>{
  for(const config of [{tokenizer:'exec'},{chunkSize:0},{overlap:281},{topK:100},{k1:Infinity},{b:-1}])assert.throws(()=>validateConfig(config));
  const baseline=validateConfig();for(const c of candidates(baseline))assert.deepEqual(validateConfig(c),c);
  assert.equal(new Set(candidates(baseline).map(c=>JSON.stringify(c))).size,candidates(baseline).length);
});
test('tokenization preserves ASCII terms and produces actual Han bigrams',()=>{
  assert.deepEqual(tokenize('BM25 检索增强','bigrams'),['bm25','检索','索增','增强']);
  assert.deepEqual(tokenize('RAG 检索','mixed'),['rag','检','索']);
  assert.deepEqual(tokenize('one two','words'),['one','two']);
});
test('retrieval excludes zero-match chunks and recall never double-counts repeated document chunks',()=>{
  const d={documents:[{id:'a',title:'apple',text:'apple '.repeat(80)},{id:'b',title:'banana',text:'banana text'}],queries:[{id:'q',text:'apple',relevantDocIds:['a','b'],split:'tuning'}]};
  const c=validateConfig({tokenizer:'mixed',chunkSize:80,overlap:0,topK:3});
  assert.deepEqual(retrieve(buildIndex(d.documents,c),'completelyunmatched'),[]);
  const m=evaluate(d,c);assert.equal(m.recall,.5);assert.equal(m.mrr,1);assert.equal(m.details[0].results.length,3);
});
test('objective uses measured retrieval quality and character overhead, without fabricated currency',()=>{
  const d=fresh(),m=evaluate(d,validateConfig(),'tuning',.08);
  assert.equal(m.objective,.7*m.recall+.3*m.mrr-.08*m.contextChars/1000);
  assert.equal(m.queries,12);assert.ok(m.durationMs>=0);assert.ok(m.details.every(x=>x.recall>=0&&x.recall<=1));
  assert.ok(!('cost' in m));
});
test('experiment loop keeps only strict tuning improvements and evaluates holdout after selection',async()=>{
  const d=fresh(),j=jobFor(d);let steps=0;
  await executeJob(j,d,{onStep:state=>{steps++;assert.equal(state.holdout,undefined);}});
  assert.equal(j.status,'completed');assert.equal(steps,8);assert.equal(j.holdout.best.split,'holdout');assert.equal(j.holdout.best.queries,6);
  let best=j.experiments[0].metrics.objective;
  for(const e of j.experiments.slice(1)){assert.equal(e.decision,e.metrics.objective>best+1e-9?'keep':'revert');best=Math.max(best,e.metrics.objective);}
  assert.equal(j.bestObjective,best);assert.equal(datasetHash(d),j.datasetHash);
  assert.match(markdownReport(j),/保留集/);
});
test('cancellation and data mutation cannot masquerade as completed holdout verification',async()=>{
  const d=fresh(),j=jobFor(d);await executeJob(j,d,{onStep:()=>{j.cancelRequested=true;}});
  assert.equal(j.status,'cancelled');assert.equal(j.holdout,undefined);assert.equal(j.experiments.length,1);
  const changed=fresh(),k=jobFor(changed);await executeJob(k,changed,{onStep:()=>{changed.documents[0].text+='changed';}});
  assert.equal(k.status,'failed');assert.match(k.error,/发生变化/);assert.equal(k.holdout,undefined);
});
test('optional provider sees tuning summaries only; credentials never enter exported records',async()=>{
  const d=fresh(),j=jobFor(d);j.strategy='model';j.maxExperiments=2;
  const provider={key:'test-only-secret',model:'test-model',baseUrl:'https://provider.example/v1'};
  const fake=async(url,options)=>{
    assert.equal(url,'https://provider.example/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-only-secret');
    const message=JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.equal(message.holdout,undefined);assert.equal(message.datasetSnapshot,undefined);assert.equal(message.queries,undefined);
    return Response.json({choices:[{message:{content:JSON.stringify(validateConfig({tokenizer:'bigrams',topK:2}))}}],usage:{prompt_tokens:120,completion_tokens:40}});
  };
  await executeJob(j,d,{provider,fetcher:fake});assert.equal(j.status,'completed');assert.equal(j.modelCalls,1);assert.equal(j.experiments[1].proposal.usage.promptTokens,120);
  assert.ok(!JSON.stringify(j).includes('test-only-secret'));assert.ok(!markdownReport(j).includes('test-only-secret'));
});
test('provider errors and malformed suggestions are explicit failures',async()=>{
  const d=fresh(),j=jobFor(d);j.experiments=[{config:validateConfig(),metrics:evaluate(d,validateConfig())}];j.bestConfig=validateConfig();
  const provider={key:'secret',model:'test',baseUrl:'https://provider.example'};
  await assert.rejects(proposeConfig(j,provider,async()=>new Response('',{status:503})),/503/);
  await assert.rejects(proposeConfig(j,provider,async()=>Response.json({choices:[{message:{content:'not json'}}]})),/无法解析/);
});
test('a provider rejection after cancellation remains cancelled without holdout results',async()=>{
  const d=fresh(),j=jobFor(d);j.strategy='model';j.maxExperiments=2;
  await executeJob(j,d,{provider:{key:'secret',model:'test',baseUrl:'https://provider.example'},fetcher:async()=>{
    j.cancelRequested=true;throw new Error('provider timed out');
  }});
  assert.equal(j.status,'cancelled');assert.equal(j.holdout,undefined);assert.equal(j.error,undefined);
});
