import seed from '../data/claims.json' with { type: 'json' };
import { TOPICS, STATUSES, RELATIONS, todaySingapore, validDate, filterArchive, projectAsOf } from '../public/archive-domain.mjs';

const json = (data, status = 200, extra = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) return json({ error: '公开 API 只读；个人修改保存在当前浏览器，不上传服务器。' }, 405, { Allow: 'GET, HEAD' });
        if (url.pathname === '/api/config') return json({ topics: TOPICS, statuses: STATUSES, relations: RELATIONS, today: todaySingapore(), snapshotDate: '2026-11-07', project: 'AI Time Capsule', storage: 'browser' });
        if (url.pathname === '/api/health') return json({ ok: true, project: 'ai-time-capsule', total: seed.claims.length, storage: 'browser', publicApi: 'read-only' });
        if (url.pathname === '/api/seed') return json(seed);
        const asOf = url.searchParams.get('asOf') || todaySingapore();
        if (!validDate(asOf) || asOf > todaySingapore()) return json({ error: '回看日期应为有效日期且不能晚于今天' }, 400);
        if (url.pathname === '/api/claims') {
          const params = Object.fromEntries(url.searchParams); params.asOf = asOf; params.own = params.own === 'true';
          const claims = filterArchive(seed.claims, params);
          return json({ asOf, claims, total: filterArchive(seed.claims, { asOf }).length, evidenceCount: claims.reduce((n, c) => n + c.evidence.length, 0) });
        }
        if (url.pathname === '/api/export') return json({ version: 1, exportedAt: new Date().toISOString(), asOf, claims: filterArchive(seed.claims, { asOf }) }, 200, { 'Content-Disposition': 'attachment; filename="ai-time-capsule-public.json"' });
        const match = url.pathname.match(/^\/api\/claims\/([^/]+)(\/history)?$/);
        if (match) {
          const record = seed.claims.find(c => c.id === decodeURIComponent(match[1]));
          const claim = record && projectAsOf(record, asOf);
          if (!claim) return json({ error: '该回看时点没有这条档案' }, 404);
          return json(match[2] ? { revisions: [] } : { claim });
        }
        return json({ error: 'API 路径不存在' }, 404);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
      const response = await env.ASSETS.fetch(request);
      const secured = new Response(response.body, response);
      secured.headers.set('X-Content-Type-Options', 'nosniff');
      secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      secured.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
      return secured;
    } catch (error) {
      console.error(JSON.stringify({ event: 'request_error', message: error instanceof Error ? error.message : 'unknown' }));
      return json({ error: '档案服务暂时不可用，请稍后重试。' }, 500);
    }
  }
};
