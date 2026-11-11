import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRepository } from '../lib/archive.mjs';
if (!process.argv[2]) { console.error('用法：npm run import -- /absolute/path/archive.json'); process.exitCode = 1; }
else {
  const repo = createRepository({ storeFile: fileURLToPath(new URL('../runtime/archive.json', import.meta.url)), seedFile: fileURLToPath(new URL('../data/claims.json', import.meta.url)) });
  const count = await repo.import(JSON.parse(await readFile(process.argv[2], 'utf8')));
  console.log(`已校验并合并 ${count} 条档案；相同 ID 会更新并保留历史。`);
}
