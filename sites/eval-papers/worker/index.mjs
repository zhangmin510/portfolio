const headers = {
  'Cache-Control': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
      }
      const url = new URL(request.url);
      if (url.pathname === '/api/health') {
        return new Response(request.method === 'HEAD' ? null : JSON.stringify({ name: 'EvalPapers', status: 'ok', mode: 'cloudflare-snapshot' }), {
          headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      if (url.pathname === '/api/papers') {
        url.pathname = '/data/catalog.json';
        return await env.ASSETS.fetch(new Request(url, request));
      }
      if (url.pathname.startsWith('/api/')) {
        return new Response('Not found', { status: 404, headers });
      }
      return await env.ASSETS.fetch(request);
    } catch {
      console.error(JSON.stringify({ event: 'request_failed', project: 'evalpapers' }));
      return new Response('Service temporarily unavailable', { status: 500, headers });
    }
  },
};
