import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
for(const file of ['server.mjs','src/engine.mjs','src/runner.mjs','public/app.js'])execFileSync(process.execPath,['--check',file]);
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of ['public','src','data','server.mjs','package.json','.env.example','README.md'])await cp(file,'dist/'+file,{recursive:true});
await writeFile('dist/BUILD.txt','AutoEval server bundle. Run node server.mjs. Runtime data and API keys are excluded.\n');
console.log('Built dist/ · server + UI + teaching dataset; no secrets or runtime records');
