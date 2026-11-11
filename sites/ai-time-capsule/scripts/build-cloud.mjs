import { readFile, rm, cp } from 'node:fs/promises';
import { validateClaim } from '../lib/archive.mjs';
const seed = JSON.parse(await readFile(new URL('../data/claims.json', import.meta.url), 'utf8'));
for (const claim of seed.claims) validateClaim(claim);
const output = new URL('../dist-cloud/', import.meta.url);
await rm(output, { recursive: true, force: true });
await cp(new URL('../public/', import.meta.url), output, { recursive: true });
console.log(`Cloudflare assets ready · ${seed.claims.length} public seed records · personal archives stay in the browser`);
