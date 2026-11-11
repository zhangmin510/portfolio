import { describe, expect, it } from 'vitest'
import worker from './index.js'

describe('homepage feedback service binding', () => {
  const url = 'https://zhangmin.name/api/feedback'

  it('passes the original URL, payload and required headers to the feedback Worker', async () => {
    const body = JSON.stringify({ title: '主页反馈', message: '在主页留下的一条反馈。' })
    const request = new Request(url, {
      method: 'POST',
      headers: {
        Origin: 'https://zhangmin.name',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.7',
        'X-Forwarded-For': '198.51.100.18',
        Cookie: 'session=private',
      },
      body,
    })
    const upstream = Response.json({ issueUrl: 'https://github.com/zhangmin510/portfolio/issues/123' }, { status: 201 })
    const response = await worker.fetch(request, {
      FEEDBACK: { async fetch(forwarded) {
        expect(forwarded.url).toBe(url)
        expect(forwarded.method).toBe('POST')
        expect(forwarded.headers.get('Origin')).toBe('https://zhangmin.name')
        expect(forwarded.headers.get('Content-Type')).toBe('application/json')
        expect(forwarded.headers.get('CF-Connecting-IP')).toBe('203.0.113.7')
        expect(forwarded.headers.has('X-Forwarded-For')).toBe(false)
        expect(forwarded.headers.has('Cookie')).toBe(false)
        expect(await forwarded.text()).toBe(body)
        return upstream
      } },
    })
    expect(response).toBe(upstream)
  })

  it.each([undefined, { fetch: async () => { throw new Error('binding unavailable') } }])('handles an unavailable feedback service', async (FEEDBACK) => {
    const response = await worker.fetch(new Request(url), { FEEDBACK })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ available: false })
    const rejected = await worker.fetch(new Request(url, { method: 'POST' }), { FEEDBACK })
    expect(rejected.status).toBe(FEEDBACK ? 502 : 503)
  })
})

describe('interactive page security and caching', () => {
  it.each(['/panoramas/eval-quest/', '/panoramas/eval-quest/index.html'])('serves %s with the scoped interaction CSP', async (pathname) => {
    const response = await worker.fetch(new Request(`https://zhangmin.name${pathname}`), {
      ASSETS: { fetch: async () => new Response('<!doctype html><title>Eval Quest</title>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self' 'unsafe-inline'")
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('does not weaken the personal homepage CSP', async () => {
    const response = await worker.fetch(new Request('https://zhangmin.name/'), {
      ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }) },
    })
    expect(response.headers.get('Content-Security-Policy')).not.toContain("'unsafe-inline'")
  })
})

const bytes = new TextEncoder().encode('0123456789')
async function fetchFilm(headers = {}, method = 'GET', path = '/keyword-film/test.mp4') {
  const request = new Request(`https://zhangmin.name${path}`, { method, headers })
  const env = { ASSETS: { fetch: async () => new Response(method === 'HEAD' ? null : bytes, {
    headers: {
      'Content-Type': 'video/mp4', 'Content-Length': '10',
      ETag: '"film-v1"', 'Last-Modified': 'Wed, 11 Nov 2026 00:00:00 GMT',
    },
  }) } }
  return worker.fetch(request, env)
}

describe('keyword film byte-range playback', () => {
  it.each([
    ['bytes=0-3', '0123', 'bytes 0-3/10'],
    ['bytes=6-', '6789', 'bytes 6-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-1000', '89', 'bytes 8-9/10'],
    ['bytes=-1000', '0123456789', 'bytes 0-9/10'],
  ])('serves %s as a correct partial response', async (range, body, contentRange) => {
    const response = await fetchFilm({ Range: range })
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe(contentRange)
    expect(response.headers.get('Content-Length')).toBe(String(body.length))
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(await response.text()).toBe(body)
  })

  it.each(['bytes=20-30', 'bytes=5-4', 'bytes=-0'])('rejects unsatisfiable %s', async (range) => {
    const response = await fetchFilm({ Range: range })
    expect(response.status).toBe(416)
    expect(response.headers.get('Content-Range')).toBe('bytes */10')
    expect(await response.text()).toBe('')
  })

  it.each([undefined, 'items=0-3', 'bytes=0-1,5-6', 'bytes=invalid'])('keeps normal responses for %s', async (range) => {
    const response = await fetchFilm(range ? { Range: range } : {})
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('0123456789')
  })

  it('does not send a partial response for an outdated If-Range validator', async () => {
    const response = await fetchFilm({ Range: 'bytes=2-4', 'If-Range': '"old-film"' })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('0123456789')
  })

  it('supports a matching If-Range validator', async () => {
    const response = await fetchFilm({ Range: 'bytes=2-4', 'If-Range': '"film-v1"' })
    expect(response.status).toBe(206)
    expect(await response.text()).toBe('234')
  })

  it.each([
    ['Wed, 11 Nov 2026 00:00:00 GMT', 206],
    ['Thu, 12 Nov 2026 00:00:00 GMT', 200],
    ['W/"film-v1"', 200],
  ])('honors exact If-Range semantics for %s', async (validator, status) => {
    const response = await fetchFilm({ Range: 'bytes=2-4', 'If-Range': validator })
    expect(response.status).toBe(status)
    expect(await response.text()).toBe(status === 206 ? '234' : '0123456789')
  })

  it('keeps HEAD body-free', async () => {
    const response = await fetchFilm({ Range: 'bytes=0-3' }, 'HEAD')
    expect(response.status).toBe(200)
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(await response.text()).toBe('')
  })

  it('does not change unrelated asset paths', async () => {
    const response = await fetchFilm({ Range: 'bytes=0-3' }, 'GET', '/other/test.mp4')
    expect(response.status).toBe(200)
    expect(response.headers.has('Accept-Ranges')).toBe(false)
    expect(await response.text()).toBe('0123456789')
  })
})
