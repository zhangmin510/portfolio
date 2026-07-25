const CSP =
  "default-src 'self'; script-src 'self' 'sha256-e1gd6rpNLMb1G1uBIFiAcNDOig3kPEnsOG6uXJQPB6U='; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

function cacheControl(pathname, status) {
  if (status === 404) return 'no-store'

  if (pathname.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable'
  }

  if (
    pathname === '/og.jpg' ||
    pathname === '/favicon.png' ||
    pathname === '/favicon-32.png' ||
    pathname === '/apple-touch-icon.png'
  ) {
    return 'public, max-age=604800, stale-while-revalidate=86400'
  }

  return 'public, max-age=0, must-revalidate'
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url)
    let response = await env.ASSETS.fetch(request)

    if (response.status === 404 && url.pathname !== '/404.html') {
      const notFoundRequest = new Request(new URL('/404.html', request.url), {
        headers: request.headers,
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      })
      const notFound = await env.ASSETS.fetch(notFoundRequest)
      response = new Response(notFound.body, {
        status: 404,
        statusText: 'Not Found',
        headers: notFound.headers,
      })
    }

    const headers = new Headers(response.headers)
    headers.set('Cache-Control', cacheControl(url.pathname, response.status))
    Object.entries(SECURITY_HEADERS).forEach(([name, value]) => {
      headers.set(name, value)
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}

export default worker
