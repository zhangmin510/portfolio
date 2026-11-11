import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../data/claims.json' with { type: 'json' };
import { createBrowserArchive } from '../public/browser-archive.mjs';
import worker from '../worker/index.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function sample(id = 'private-browser-claim') {
  return { ...structuredClone(seed.claims[0]), id, title: '浏览器私有测试档案', origin: 'custom' };
}
const body = data => ({ method: 'POST', body: JSON.stringify(data) });

test('browser archives persist independently and personal exports include local records', async () => {
  const aliceStorage = memoryStorage();
  const alice = createBrowserArchive({ seed, storage: aliceStorage });
  const bob = createBrowserArchive({ seed, storage: memoryStorage() });
  await alice.request('/api/claims', body(sample()));
  const reloaded = createBrowserArchive({ seed, storage: aliceStorage });
  assert.equal((await reloaded.request('/api/claims')).total, seed.claims.length + 1);
  assert.equal((await bob.request('/api/claims')).total, seed.claims.length);
  const exported = await reloaded.request('/api/export');
  assert.equal(exported.claims.at(-1)?.id === 'private-browser-claim' || exported.claims.some(c => c.id === 'private-browser-claim'), true);
  assert.equal((await bob.request('/api/export')).claims.some(c => c.id === 'private-browser-claim'), false);
  assert.equal((await reloaded.request('/api/claims/private-browser-claim/history')).revisions.length, 1);
});

test('browser import validates an entire batch and failed commits do not replace data', async () => {
  const storage = memoryStorage();
  const archive = createBrowserArchive({ seed, storage });
  await archive.request('/api/claims', body(sample('one')));
  await assert.rejects(archive.request('/api/import', body([sample('two'), { ...sample('bad'), date: '2099-01-01' }])), /未来|核验日期/);
  assert.equal((await archive.request('/api/claims')).total, seed.claims.length + 1);
  const unavailable = createBrowserArchive({ seed, storage: { getItem: storage.getItem, setItem: () => { throw new Error('Quota'); } } });
  await assert.rejects(unavailable.request('/api/claims', body(sample('never-saved'))), /未保存/);
  assert.equal((await archive.request('/api/claims')).total, seed.claims.length + 1);
});

test('browser history retains old text and removes future evidence and assessments', async () => {
  const archive = createBrowserArchive({ seed, storage: memoryStorage() });
  const before = (await archive.request('/api/claims')).claims.find(c => c.date < '2024-12-31');
  await archive.request(`/api/claims/${before.id}`, { method: 'PUT', body: JSON.stringify({ ...before, title: '今天改写的新标题' }) });
  const old = await archive.request(`/api/claims/${before.id}?asOf=2024-12-31`);
  assert.notEqual(old.claim.title, '今天改写的新标题');
  assert.equal(old.claim.assessments.length, 0);
  assert.ok(old.claim.evidence.every(e => e.date <= '2024-12-31'));
  const current = await archive.request(`/api/claims/${before.id}`);
  assert.equal(current.claim.title, '今天改写的新标题');
});

test('public worker has read-only APIs and never receives or mutates personal archives', async () => {
  const env = { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } };
  const config = await (await worker.fetch(new Request('https://timecapsule.zhangmin.name/api/config'), env)).json();
  assert.equal(config.storage, 'browser');
  const write = await worker.fetch(new Request('https://timecapsule.zhangmin.name/api/claims', body(sample())), env);
  assert.equal(write.status, 405);
  const data = await (await worker.fetch(new Request('https://timecapsule.zhangmin.name/api/claims?asOf=2024-12-31'), env)).json();
  assert.equal(data.total, 7);
  assert.ok(data.claims.every(c => !c.assessment && c.evidence.every(e => e.date <= '2024-12-31')));
  const missing = await worker.fetch(new Request('https://timecapsule.zhangmin.name/api/missing'), env);
  assert.equal(missing.status, 404);
  const asset = await worker.fetch(new Request('https://timecapsule.zhangmin.name/missing-file'), env);
  assert.equal(asset.status, 404);
  assert.match(asset.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});
