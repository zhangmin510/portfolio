import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';
test('HTTP API filters historical evidence and exports the same snapshot',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'capsule-http-'));
  const server=createApp({storeFile:path.join(directory,'archive.json')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const list=await fetch(`${base}/api/claims?asOf=2024-12-31`).then(r=>r.json());
    assert.ok(list.claims.length>0);assert.ok(list.claims.every(c=>c.evidence.every(e=>e.date<='2024-12-31') && c.status==='pending'));
    const exported=await fetch(`${base}/api/export?asOf=2024-12-31`).then(r=>r.json());
    assert.deepEqual(exported.claims,list.claims);
    assert.equal((await fetch(`${base}/api/claims?asOf=2099-01-01`)).status,400);
    assert.equal((await fetch(`${base}/api/claims/gpt4-benchmarks?asOf=2020-01-01`)).status,404);
    assert.equal((await fetch(`${base}/api/import`,{method:'POST',headers:{'content-type':'application/json',origin:'https://other.example'},body:'{}'})).status,403);
    assert.equal((await fetch(`${base}/api/import`,{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await fetch(`${base}/api/import`,{method:'POST',headers:{'content-type':'application/json'},body:'broken json'})).status,400);
    assert.equal((await fetch(`${base}/`)).status,200);
    assert.equal((await fetch(`${base}/data/claims.json`)).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
