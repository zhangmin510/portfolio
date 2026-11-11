import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createApp} from '../server.mjs';

async function waitFor(check){
  const deadline=Date.now()+3000;
  while(Date.now()<deadline){if(await check())return;await delay(5);}
  assert.fail('timed out waiting for the test condition');
}
async function appFor(t,fetcher=async()=>{throw new Error('unexpected provider call');}){
  const runtime=await mkdtemp(path.join(os.tmpdir(),'auto-eval-test-'));
  const server=await createApp({runtime,fetcher,provider:{key:'test-only-secret',model:'test-model',baseUrl:'https://provider.example/v1'}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(runtime,{recursive:true,force:true});});
  return {server,base,runtime};
}
const input={datasetId:'retrieval-lab',strategy:'model',maxExperiments:2};

test('API mutations require an exact browser origin and JSON content type',async t=>{
  const {base}=await appFor(t);
  const differentPort=new URL(base);differentPort.port=String(Number(differentPort.port)+1);
  for(const origin of [differentPort.origin,'http://localhost:9999','https://evil.example','null']){
    const response=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:JSON.stringify(input)});
    assert.equal(response.status,403,origin);
  }
  const plain=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:base,'Content-Type':'text/plain'},body:JSON.stringify(input)});
  assert.equal(plain.status,415);
  assert.deepEqual(await (await fetch(base+'/api/jobs')).json(),[]);
});

test('concurrent submissions reserve one slot; cancellation aborts the pending provider',async t=>{
  let calls=0,aborted=false;
  const {server,base,runtime}=await appFor(t,async(_url,{signal})=>{
    calls++;
    return new Promise((_resolve,reject)=>{
      const abort=()=>{aborted=true;reject(signal.reason);};
      if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    });
  });
  let markStarted;const started=new Promise(resolve=>{markStarted=resolve;});
  server.on('request',req=>{if(req.headers['x-test-slow']==='yes')markStarted();});
  const body=JSON.stringify(input),half=Math.floor(body.length/2),url=new URL(base);
  let slow;
  const result=new Promise((resolve,reject)=>{
    slow=http.request({hostname:url.hostname,port:url.port,path:'/api/jobs',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'X-Test-Slow':'yes'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });
    slow.on('error',reject);slow.write(body.slice(0,half));
  });
  t.after(()=>slow.destroy());
  await started;
  const accepted=await fetch(base+'/api/jobs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body});
  assert.equal(accepted.status,201);const job=await accepted.json();
  slow.end(body.slice(half));assert.equal(await result,409);
  await waitFor(()=>calls===1);
  assert.equal((await (await fetch(base+'/api/jobs')).json()).length,1);
  const stopped=await fetch(base+`/api/jobs/${job.id}/cancel`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
  assert.equal(stopped.status,200);
  await waitFor(async()=>{
    const saved=JSON.parse(await readFile(path.join(runtime,'jobs',job.id+'.json'),'utf8'));
    return saved.status==='cancelled';
  });
  const final=await (await fetch(base+`/api/jobs/${job.id}`)).json();
  assert.equal(final.status,'cancelled');assert.equal(final.holdout,undefined);assert.equal(final.error,undefined);assert.equal(aborted,true);
  assert.ok(!JSON.stringify(final).includes('test-only-secret'));
});
