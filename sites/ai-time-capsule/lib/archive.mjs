import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { validateClaim, validateImport } from '../public/archive-domain.mjs';
export * from '../public/archive-domain.mjs';

export function createRepository({ storeFile, seedFile }) {
  let queue = Promise.resolve();
  async function load() {
    try { return JSON.parse(await readFile(storeFile, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const seed = JSON.parse(await readFile(seedFile, 'utf8'));
      return { version: 1, claims: seed.claims.map(c => validateClaim(c, { origin: 'seed' })), revisions: [] };
    }
  }
  async function commit(store) {
    await mkdir(path.dirname(storeFile), { recursive: true });
    const temporary = `${storeFile}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, storeFile);
  }
  function mutate(action) {
    const operation = queue.then(async () => { const store = await load(); const result = await action(store); await commit(store); return result; });
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    load,
    save(input, { existingId } = {}) {
      return mutate(store => {
        const previous = existingId ? store.claims.find(c => c.id === existingId) : null;
        if (existingId && !previous) throw new Error('找不到要编辑的档案');
        const claim = validateClaim({ ...input, id: existingId || input.id }, { origin: previous?.origin || 'custom' });
        if (!existingId && store.claims.some(c => c.id === claim.id)) throw new Error('档案 ID 已存在');
        if (previous) store.claims[store.claims.findIndex(c => c.id === existingId)] = claim;
        else store.claims.push(claim);
        store.revisions.push({ id: randomUUID(), claimId: claim.id, savedAt: new Date().toISOString(), action: previous ? 'edit' : 'create', previous, current: claim });
        return claim;
      });
    },
    import(payload) {
      const records = validateImport(payload);
      return mutate(store => {
        for (const claim of records) {
          const index = store.claims.findIndex(c => c.id === claim.id);
          const previous = index >= 0 ? store.claims[index] : null;
          if (index >= 0) store.claims[index] = claim; else store.claims.push(claim);
          store.revisions.push({ id: randomUUID(), claimId: claim.id, savedAt: new Date().toISOString(), action: 'import', previous, current: claim });
        }
        return records.length;
      });
    }
  };
}
