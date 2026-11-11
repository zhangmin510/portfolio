import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { topics,tokenize,makeVectors,cosine,recommend,matches,selectPapers,similarPapers,cleanPreferences,escapeHTML,toggle } from '../public/lib.js';
import { parseArxivAtom,decodeXML } from '../scripts/arxiv.mjs';
import { handle,resolvePublicPath } from '../server.mjs';
const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url)));
const papers=catalog.papers;

test('seed papers use distinct verified official arXiv records and complete reading notes',()=>{
  assert.equal(papers.length,20);assert.equal(new Set(papers.map(p=>p.id)).size,20);
  for(const p of papers){assert.match(p.id,/^\d{4}\.\d{4,5}$/);assert.equal(p.arxivUrl,`https://arxiv.org/abs/${p.id}`);assert.ok(p.authors.length&&p.authors.every(a=>typeof a==='string'&&a.trim()));assert.ok(Date.parse(p.published));assert.ok(p.title&&p.summary&&p.question&&p.verifiedAt);assert.ok(p.topics.every(t=>topics[t]));if(p.codeUrl)assert.match(p.codeUrl,/^https:\/\/github\.com\//);}
  assert.match(papers.find(p=>p.id==='2310.06770').title,/SWE-bench/);
  assert.match(papers.find(p=>p.id==='2309.15217').title,/Ragas/);
  assert.notEqual(papers.find(p=>p.id==='2401.15884').shortTitle,papers.find(p=>p.id==='2406.04744').shortTitle);
});
test('TF-IDF vectors are normalized and related retrieval papers outrank unrelated model questions',()=>{
  const vectors=makeVectors(papers),rag= papers.find(p=>p.shortTitle==='Ragas'),checker=papers.find(p=>p.shortTitle==='RAGChecker'),gpqa=papers.find(p=>p.shortTitle==='GPQA');
  assert.ok(Math.abs(cosine(vectors.get(rag.id),vectors.get(rag.id))-1)<1e-9);
  assert.ok(cosine(vectors.get(rag.id),vectors.get(checker.id))>cosine(vectors.get(rag.id),vectors.get(gpqa.id)));
  assert.equal(cosine(null,vectors.get(rag.id)),0);
});
test('favorites and explicit topic preferences change recommendations and ignoring hides records',()=>{
  const base=recommend(papers),rag=papers.find(p=>p.shortTitle==='Ragas');
  assert.deepEqual(base.map(p=>p.id),papers.map(p=>p.id));
  const preferred=recommend(papers,{favorites:[rag.id],topics:['search'],ignored:['2504.12516']});
  assert.ok(!preferred.some(p=>p.id==='2504.12516'));
  assert.ok(preferred[0].topics.includes('search'));
  assert.ok(preferred[0].recommendation.hasProfile);
  assert.match(preferred[0].recommendation.reason,/收藏|主题/);
});
test('search supports common Chinese terms and all search words must match',()=>{
  const os= papers.find(p=>p.shortTitle==='OSWorld');assert.equal(matches(os,'多模态 应用'),true);assert.equal(matches(os,'不存在的词'),false);
  const rag=papers.find(p=>p.shortTitle==='Ragas');assert.equal(matches(rag,'检索 忠实'),true);assert.equal(matches(rag,'rag quantumunknown'),false);
  assert.ok(tokenize('TF-IDF 相关性分析').includes('相关'));
});
test('composable view, topic, tag and time sorting respect saved and ignored preferences',()=>{
  const preferences={favorites:['2309.15217','2311.12022'],ignored:['2504.12516'],tags:{'2309.15217':['待读']}};
  assert.deepEqual(selectPapers(papers,preferences,{view:'saved',topic:'search',tag:'待读'}).map(p=>p.id),['2309.15217']);
  assert.deepEqual(selectPapers(papers,preferences,{view:'ignored'}).map(p=>p.id),['2504.12516']);
  const sorted=selectPapers(papers,{}, {sort:'newest'});assert.ok(sorted[0].published>=sorted.at(-1).published);
  assert.equal(papers[0].id,'2504.12516','sorting must not mutate source order');
});
test('related reading excludes itself and preferences import rejects unknown IDs and HTML stays text',()=>{
  const p=papers[0],related=similarPapers(p,papers,3);assert.equal(related.length,3);assert.ok(related.every(x=>x.id!==p.id));
  const clean=cleanPreferences({favorites:[p.id,p.id,'evil'],ignored:[p.id],topics:['search','evil'],tags:{[p.id]:['待读','待读',5],evil:['x']}},new Set(papers.map(p=>p.id)));
  assert.deepEqual(clean,{favorites:[p.id],ignored:[],topics:['search'],tags:{[p.id]:['待读']}});
  assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  const a=['x'];assert.deepEqual(toggle(a,'x'),[]);assert.deepEqual(a,['x']);
});
const atom=`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2309.15217v2</id><title>A &amp; B\n Paper</title><published>2023-09-26T19:23:54Z</published><updated>2024-01-01T00:00:00Z</updated><author><name>Shahul Es</name></author><author><name>Jithin James</name></author></entry></feed>`;
test('Atom parsing extracts canonical IDs, versions, authors, dates and safely decodes XML',()=>{
  const [p]=parseArxivAtom(atom);assert.equal(p.id,'2309.15217');assert.equal(p.version,'v2');assert.equal(p.title,'A & B Paper');assert.deepEqual(p.authors,['Shahul Es','Jithin James']);assert.equal(p.published,'2023-09-26');assert.equal(p.pdfUrl,'https://arxiv.org/pdf/2309.15217');assert.equal(decodeXML('&#x3c4; &apos; &#65;'),'τ \' A');
  assert.throws(()=>parseArxivAtom('<!DOCTYPE feed SYSTEM "file:///etc/passwd"><feed/>'),/Invalid/);
  assert.throws(()=>parseArxivAtom('<feed><entry><id>http://arxiv.org/abs/2309.15217</id><title>Missing metadata</title></entry></feed>'),/Incomplete/);
  assert.throws(()=>parseArxivAtom('<feed/>'),/no paper/);
});
test('duplicate Atom records are deduplicated using the canonical ID',()=>{
  const duplicate=atom.replace('</feed>',atom.match(/<entry>[\s\S]*<\/entry>/)[0]+'</feed>');assert.equal(parseArxivAtom(duplicate).length,1);
});
test('server serves public data and rejects traversal and mutation methods',async()=>{
  const response=await handle(new Request('http://localhost/api/papers'));assert.equal(response.status,200);assert.equal((await response.json()).papers.length,20);
  const root=await handle(new Request('http://localhost/'));assert.equal(root.status,200);assert.match(await root.text(),/EvalPapers/);
  assert.equal(resolvePublicPath('/%2e%2e%2fpackage.json'),null);
  assert.equal(resolvePublicPath('/%00x'),null);
  assert.equal((await handle(new Request('http://localhost/package.json'))).status,404);
  assert.equal((await handle(new Request('http://localhost/api/papers',{method:'POST'}))).status,405);
});
test('failed data updates preserve the previous output even if a feed omits curated papers',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'evalpapers-test-'));
  try{const output=path.join(dir,'catalog.json'),source=path.join(dir,'partial.xml');await writeFile(output,'existing snapshot');await writeFile(source,atom);const result=spawnSync(process.execPath,[new URL('../scripts/update-data.mjs',import.meta.url).pathname,'--source',source,'--output',output],{encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/existing catalog was kept/);assert.equal(await readFile(output,'utf8'),'existing snapshot');}
  finally{await rm(dir,{recursive:true,force:true});}
});
