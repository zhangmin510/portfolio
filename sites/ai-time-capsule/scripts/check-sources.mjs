import { readFile } from 'node:fs/promises';
const { claims } = JSON.parse(await readFile(new URL('../data/claims.json', import.meta.url), 'utf8'));
const urls = [...new Set(claims.flatMap(c => [c.source.url, ...c.evidence.map(e => e.source.url)]))];
let failures = 0;
// Connectivity is not factual verification; this command does not change verifiedAt.
for (const url of urls) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    console.log(`${response.status} ${url}`);
    if (!response.ok) failures++;
  } catch (error) { failures++; console.log(`ERR ${url} (${error.message})`); }
}
console.log(`检查 ${urls.length} 个链接；${failures} 个需人工复核。站点拒绝 HEAD 也会列入复核。`);
if (failures) process.exitCode = 1;
