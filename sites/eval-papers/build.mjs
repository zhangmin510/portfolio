import { readFile,mkdir,rm,cp,writeFile } from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('./data/catalog.json',import.meta.url)));
if(!catalog.papers?.length)throw new Error('Empty paper catalog');
await rm(new URL('./dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('./dist/data/',import.meta.url),{recursive:true});
await cp(new URL('./public/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
await writeFile(new URL('./dist/data/catalog.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n');
console.log(`Built EvalPapers · ${catalog.papers.length} verified papers · dist/`);
