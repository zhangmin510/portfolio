const CSP =
  "default-src 'self'; script-src 'self' 'sha256-e1gd6rpNLMb1G1uBIFiAcNDOig3kPEnsOG6uXJQPB6U='; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"

// Standalone panoramas include their application scripts, styles, and export tools.
const PANORAMA_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' data: blob: https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net; frame-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const FEEDBACK_REQUEST_HEADERS = ['Origin', 'Content-Type', 'Content-Length', 'CF-Connecting-IP']

function feedbackJson(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  })
}

async function forwardFeedback(request, service) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return feedbackJson({ message: '此接口支持查询和提交留言。' }, 405, { Allow: 'GET, POST' })
  }

  if (!service) {
    return request.method === 'GET'
      ? feedbackJson({ available: false })
      : feedbackJson({ message: '匿名留言暂不可用。' }, 503)
  }

  const headers = new Headers()
  for (const name of FEEDBACK_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }

  try {
    // Keep the original URL for the shared Worker's same-origin check and source label.
    return await service.fetch(new Request(request, { headers }))
  } catch {
    return request.method === 'GET'
      ? feedbackJson({ available: false })
      : feedbackJson({ message: '暂时无法确认留言提交结果。' }, 502)
  }
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

// Static Assets returns the whole file for Range requests. Native video seeking
// needs byte ranges, so provide them for the small, same-origin keyword film.
async function withVideoRange(request, response) {
  const headers = new Headers(response.headers)
  headers.set('Accept-Ranges', 'bytes')
  const full = () => new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
  if (request.method !== 'GET') return full()

  const range = request.headers.get('Range')
  if (!range) return full()
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  // Ignore unsupported units, malformed ranges, and multipart range requests.
  if (!match || (!match[1] && !match[2])) return full()

  const ifRange = request.headers.get('If-Range')
  if (ifRange) {
    const etag = response.headers.get('ETag')
    const modified = Date.parse(response.headers.get('Last-Modified') || '')
    const isTag = ifRange.startsWith('"') || ifRange.startsWith('W/')
    const since = isTag ? NaN : Date.parse(ifRange)
    const matchesTag = !ifRange.startsWith('W/') && ifRange === etag
    const matchesDate = Number.isFinite(modified) && Number.isFinite(since) && since === modified
    if (!matchesTag && !matchesDate) return full()
  }

  const bytes = await response.arrayBuffer()
  const size = bytes.byteLength
  const suffix = !match[1]
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1])
  const end = suffix || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]))
  if (!size || !Number.isFinite(start) || start >= size || end < start) {
    headers.set('Content-Range', `bytes */${size}`)
    headers.set('Content-Length', '0')
    return new Response(null, { status: 416, headers })
  }

  const partial = bytes.slice(start, end + 1)
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(partial.byteLength))
  return new Response(partial, { status: 206, headers })
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/feedback') return forwardFeedback(request, env.FEEDBACK)

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

    if (
      response.status === 200 &&
      url.pathname.startsWith('/keyword-film/') &&
      url.pathname.endsWith('.mp4')
    ) {
      response = await withVideoRange(request, response)
    }

    const headers = new Headers(response.headers)
    headers.set('Cache-Control', cacheControl(url.pathname, response.status))
    Object.entries(SECURITY_HEADERS).forEach(([name, value]) => {
      headers.set(name, value)
    })
    if (
      url.pathname.startsWith('/panoramas/') &&
      (response.status === 304 ||
        (response.status === 200 &&
          headers.get('Content-Type')?.includes('text/html')))
    ) {
      headers.set('Content-Security-Policy', PANORAMA_CSP)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}

export default worker
