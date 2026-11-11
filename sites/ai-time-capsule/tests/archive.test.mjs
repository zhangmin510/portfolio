import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateClaim, validateImport, projectAsOf, filterArchive, materializeAsOf, createRepository, safeUrl } from '../lib/archive.mjs';
const seedFile = fileURLToPath(new URL('../data/claims.json', import.meta.url));
const seed = JSON.parse(await readFile(seedFile, 'utf8'));
const fixture = () => ({ id: 'test-claim', title: '测试原始主张', organization: '研究机构', topic: 'agents', date: '2024-01-01', claim: '在指定任务中有效。', scope: '仅限实验范围。', verifiedAt: '2026-11-07', source: { title: '原始论文', publisher: '研究机构', date: '2024-01-01', url: 'https://example.org/original' }, evidence: [{ id:'e1', date:'2024-06-01', relation:'context', title:'首次证据', summary:'有适用条件。', source:{ title:'首次更新',publisher:'研究机构',date:'2024-06-01',url:'https://example.org/first' } }, { id:'e2',date:'2025-06-01',relation:'supports',title:'后续证据',summary:'任务完成。',source:{ title:'后续更新',publisher:'研究机构',date:'2025-06-01',url:'https://example.org/second' }}], assessments:[{ id:'a1',date:'2024-07-01',status:'partial',summary:'有限支持。',caveat:'实验条件有限。',author:'编辑',basisEvidenceIds:['e1'] },{ id:'a2',date:'2025-07-01',status:'supported',summary:'特定范围有支持。',author:'编辑',basisEvidenceIds:['e1','e2'] }] });

test('nine curated records validate and cover all four domains', () => {
  assert.equal(seed.claims.length,9);
  assert.deepEqual(new Set(seed.claims.map(c => validateClaim(c).topic)),new Set(['agents','models','search','apps']));
  assert.equal(new Set(seed.claims.map(c => c.id)).size,9);
});
test('as-of projection removes future claims, evidence, and verdicts', () => {
  const claim=validateClaim(fixture());
  assert.equal(projectAsOf(claim,'2023-12-31'),null);
  const first=projectAsOf(claim,'2024-06-15');
  assert.deepEqual(first.evidence.map(e=>e.id),['e1']);
  assert.equal(first.assessment,null);assert.equal(first.status,'pending');
  assert.equal(projectAsOf(claim,'2024-12-31').status,'partial');
  assert.equal(projectAsOf(claim,'2025-07-01').status,'supported');
});
test('search never matches text from hidden future evidence', () => {
  const claim=validateClaim(fixture());
  assert.equal(filterArchive([claim],{asOf:'2024-12-31',q:'后续证据'}).length,0);
  assert.equal(filterArchive([claim],{asOf:'2025-12-31',q:'后续证据'}).length,1);
});
test('assessment cannot precede its evidence or use missing evidence', () => {
  const early=fixture(); early.assessments[0].date='2024-05-01';
  assert.throws(()=>validateClaim(early),/不能早于/);
  const missing=fixture(); missing.assessments[0].basisEvidenceIds=['missing'];
  assert.throws(()=>validateClaim(missing),/不存在/);
});
test('publication dates cannot leak a future source into an earlier view', () => {
  const original=fixture(); original.source.date='2024-02-01';
  assert.throws(()=>validateClaim(original),/来源日期/);
  const evidence=fixture(); evidence.evidence[0].source.date='2025-01-01';
  assert.throws(()=>validateClaim(evidence),/来源日期/);
});
test('invalid calendar dates, future data, statuses, and unsafe links are rejected', () => {
  const bad=fixture();bad.date='2024-02-30';assert.throws(()=>validateClaim(bad),/有效/);
  const future=fixture();future.evidence[0].date='2099-01-01';assert.throws(()=>validateClaim(future),/证据日期/);
  const status=fixture();status.assessments[0].status='certain';assert.throws(()=>validateClaim(status),/状态/);
  for(const url of ['javascript:alert(1)','http://example.org','https://user:pass@example.org']) assert.throws(()=>safeUrl(url));
});
test('backdated view restores text from before a later local edit', () => {
  const previous=validateClaim(fixture()); const current={...previous,title:'后来改写的标题'};
  const store={claims:[current],revisions:[{claimId:current.id,savedAt:'2026-01-01T00:00:00Z',previous,current}]};
  assert.equal(materializeAsOf(store,'2025-12-31')[0].title,previous.title);
  assert.equal(materializeAsOf(store,'2026-01-01')[0].title,current.title);
});
test('seed editorial judgments are not antedated to the original claims',()=>{
  const claims=filterArchive(seed.claims,{asOf:'2025-12-31'});
  assert.ok(claims.length>0);assert.ok(claims.every(c=>c.status==='pending' && c.assessments.length===0));
  assert.ok(claims.every(c=>c.evidence.every(e=>e.date<='2025-12-31')));
});
test('import validates whole batch, rejects duplicate IDs and preserves local versions',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'capsule-repository-'));
  try{
    const repo=createRepository({storeFile:path.join(directory,'archive.json'),seedFile});
    assert.throws(()=>validateImport([fixture(),fixture()]),/重复/);
    assert.throws(()=>repo.import({version:1,claims:[fixture(),{...fixture(),id:'invalid',topic:'invalid'}]}),/领域/);
    assert.equal((await repo.load()).claims.length,9);
    await repo.save(fixture());
    await repo.save({...fixture(),title:'改过的标题'},{existingId:'test-claim'});
    const restored=createRepository({storeFile:path.join(directory,'archive.json'),seedFile});
    const persisted=await restored.load();
    assert.equal(persisted.claims.length,10);assert.equal(persisted.claims.find(c=>c.id==='test-claim').title,'改过的标题');
    assert.equal(persisted.revisions.length,2);assert.equal(persisted.revisions[1].previous.title,'测试原始主张');
    assert.equal(await restored.import({version:1,claims:[{...fixture(),title:'导入更新'}]}),1);
    assert.equal((await restored.load()).claims.length,10);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('concurrent writes are serialized without losing either record',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'capsule-concurrent-'));
  try{
    const repo=createRepository({storeFile:path.join(directory,'archive.json'),seedFile});
    await Promise.all([repo.save({...fixture(),id:'one'}),repo.save({...fixture(),id:'two'})]);
    assert.equal((await repo.load()).claims.length,11);
  }finally{await rm(directory,{recursive:true,force:true});}
});
