import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';

test('Cloudflare worker preserves the public catalog API through its asset binding', async () => {
  const calls = [];
  const env = { ASSETS: { fetch: async request => {
    calls.push({ url: request.url, method: request.method });
    return Response.json({ papers: [{ id: '2309.15217' }] });
  } } };
  const response = await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/papers'), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).papers[0].id, '2309.15217');
  assert.deepEqual(calls, [{ url: 'https://evalpapers.zhangmin.name/data/catalog.json', method: 'GET' }]);
  await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/papers', { method: 'HEAD' }), env);
  assert.equal(calls.at(-1).method, 'HEAD');
});

test('Cloudflare worker health is read-only, API misses stay 404, and errors do not reveal internal data', async () => {
  const env = { ASSETS: { fetch: async () => { throw new Error('private provider credentials'); } } };
  const health = await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/health'), env);
  assert.equal((await health.json()).mode, 'cloudflare-snapshot');
  const head = await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/health', { method: 'HEAD' }), env);
  assert.equal(await head.text(), '');
  assert.equal((await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/unknown'), env)).status, 404);
  const post = await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/papers', { method: 'POST', body: '{}' }), env);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  const failed = await worker.fetch(new Request('https://evalpapers.zhangmin.name/api/papers'), env);
  assert.equal(failed.status, 500);
  assert.doesNotMatch(await failed.text(), /private|credentials/);
});
