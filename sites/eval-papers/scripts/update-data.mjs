import { readFile,writeFile,rename,rm,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseArxivAtom } from './arxiv.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
async function main(){
  const manifest=JSON.parse(await readFile(path.join(root,'data/manifest.json'),'utf8'));
  const ids=manifest.papers.map(p=>p.id);
  if(ids.some(id=>!/^\d{4}\.\d{4,5}$/.test(id))||new Set(ids).size!==ids.length)throw new Error('Invalid or duplicate curated arXiv IDs');
  const url=new URL('https://export.arxiv.org/api/query');url.searchParams.set('id_list',ids.join(','));url.searchParams.set('max_results',String(ids.length));
  let xml;
  if(option('--source'))xml=await readFile(path.resolve(option('--source')),'utf8');
  else{const r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'EvalPapers/1.0 (local research reading list)'}});if(!r.ok)throw new Error(`arXiv HTTP ${r.status}`);xml=await r.text();}
  const raw=parseArxivAtom(xml),index=new Map(raw.map(p=>[p.id,p]));
  const now=new Date().toISOString();
  const papers=manifest.papers.map((curated,order)=>{const record=index.get(curated.id);if(!record)throw new Error(`arXiv did not return ${curated.id}; preserving previous catalog`);return {...record,...curated,order,verifiedAt:manifest.reviewedAt,metadataSource:record.arxivUrl};});
  const catalog={meta:{name:'EvalPapers',total:papers.length,fetchedAt:now,reviewedAt:manifest.reviewedAt,source:'arXiv API + manually reviewed Chinese notes',sourceUrl:url.href,mode:'snapshot',algorithm:'TF-IDF cosine similarity + explicit topic preferences; not an LLM or citation ranking',attribution:'Paper metadata belongs to the authors and arXiv. Chinese reading notes are independently written; full papers are linked, not redistributed.'},papers};
  const output=path.resolve(option('--output')||path.join(root,'data/catalog.json'));const temp=output+'.tmp';
  await mkdir(path.dirname(output),{recursive:true});
  try{await writeFile(temp,JSON.stringify(catalog,null,2)+'\n');await rename(temp,output);}finally{await rm(temp,{force:true});}
  console.log(`Updated ${papers.length} papers from official arXiv metadata. Existing catalog is preserved on failure.`);
}
main().catch(error=>{console.error(`Update failed; existing catalog was kept. ${error.message}`);process.exitCode=1;});
