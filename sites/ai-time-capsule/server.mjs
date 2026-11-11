import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TOPICS, STATUSES, RELATIONS, todaySingapore, filterArchive, projectAsOf, createRepository, validDate, materializeAsOf, revisionDay } from './lib/archive.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ storeFile = path.join(root, 'runtime/archive.json'), seedFile = path.join(root, 'data/claims.json') } = {}) {
  const repo = createRepository({ storeFile, seedFile });
  async function body(request) {
    let bytes = 0; const chunks = [];
    for await (const chunk of request) { bytes += chunk.length; if (bytes > 2_000_000) { const error = new Error('文件不能超过 2 MB'); error.status = 413; throw error; } chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('请求不是有效 JSON'); }
  }
  const json = (response, data, status = 200, extra = {}) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
    response.end(JSON.stringify(data));
  };
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/')) {
        const method = request.method;
        if (!['GET', 'HEAD'].includes(method)) {
          const origin = request.headers.origin;
          if (origin && new URL(origin).host !== request.headers.host) { json(response, { error: '不允许跨站修改本地档案' }, 403); return; }
          if (!String(request.headers['content-type'] || '').includes('application/json')) { json(response, { error: '请使用 application/json' }, 415); return; }
        }
        if (pathname === '/api/config' && method === 'GET') { json(response, { topics: TOPICS, statuses: STATUSES, relations: RELATIONS, today: todaySingapore(), snapshotDate: '2026-11-07', project: 'AI Time Capsule' }); return; }
        const store = await repo.load();
        const asOf = url.searchParams.get('asOf') || todaySingapore();
        if (!validDate(asOf) || asOf > todaySingapore()) { json(response, { error: '回看日期应为有效日期且不能晚于今天' }, 400); return; }
        const historical = materializeAsOf(store, asOf);
        if (pathname === '/api/health' && method === 'GET') { json(response, { ok: true, project: 'ai-time-capsule', total: store.claims.length }); return; }
        if (pathname === '/api/claims' && method === 'GET') {
          const params = Object.fromEntries(url.searchParams); params.own = params.own === 'true'; params.asOf = asOf;
          const claims = filterArchive(historical, params);
          json(response, { asOf, claims, total: filterArchive(historical, { asOf }).length, evidenceCount: claims.reduce((n,c) => n + c.evidence.length, 0) }); return;
        }
        if (pathname === '/api/claims' && method === 'POST') { const record = await repo.save(await body(request)); json(response, { claim: projectAsOf(record) }, 201); return; }
        if (pathname === '/api/import' && method === 'POST') { const count = await repo.import(await body(request)); json(response, { imported: count }); return; }
        if (pathname === '/api/export' && method === 'GET') { json(response, { version: 1, exportedAt: new Date().toISOString(), asOf, claims: filterArchive(historical, { asOf }) }, 200, { 'Content-Disposition': 'attachment; filename="ai-time-capsule.json"' }); return; }
        const match = pathname.match(/^\/api\/claims\/([^/]+)(\/history)?$/);
        if (match) {
          const claim = historical.find(c => c.id === match[1]);
          const projected = claim && projectAsOf(claim, asOf);
          if (!projected) { json(response, { error: '该回看时点没有这条档案' }, 404); return; }
          if (match[2] && method === 'GET') {
            const revisions = store.revisions.filter(r => r.claimId === claim.id && revisionDay(r.savedAt) <= asOf).map(r => ({ ...r, previous: r.previous && projectAsOf(r.previous,asOf), current: projectAsOf(r.current,asOf) }));
            json(response, { revisions }); return;
          }
          if (!match[2] && method === 'GET') { json(response, { claim: projected }); return; }
          if (!match[2] && method === 'PUT') { const updated = await repo.save(await body(request), { existingId: claim.id }); json(response, { claim: projectAsOf(updated) }); return; }
        }
        json(response, { error: 'API 路径不存在' }, 404); return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      let base = path.join(root, 'public');
      try { if ((await stat(path.join(root,'dist/index.html'))).isFile()) base = path.join(root, 'dist'); } catch {}
      const file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(base + path.sep)) { response.writeHead(403); response.end('Forbidden'); return; }
      try {
        const data = await readFile(file);
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
        response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
        response.end(request.method === 'HEAD' ? undefined : data);
      } catch { response.writeHead(404); response.end('Not found'); }
    } catch (error) { json(response, { error: error.message || '本地服务暂时不可用' }, error.status || 400); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(Number(process.env.PORT || 4323), '127.0.0.1', () => console.log(`AI Time Capsule → http://localhost:${process.env.PORT || 4323}`));
}
