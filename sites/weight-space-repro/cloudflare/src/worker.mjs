const MAX_SLICE_BYTES = 8 * 1024 * 1024
const CHECKPOINT_NAME = 'model.safetensors-00001-of-00001.safetensors'
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
}

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function assetRequest(request, path, init) {
  return new Request(new URL(path, request.url), init)
}

async function readManifest(request, env) {
  const response = await env.ASSETS.fetch(assetRequest(request, '/data/weights.json'))
  if (!response.ok) throw new RequestError(503, '权重索引暂不可用')
  return response.json()
}

function offset(value) {
  return /^\d{1,10}$/.test(value ?? '') ? Number(value) : NaN
}

async function upstreamRange(manifest, start, end, signal) {
  const response = await fetch(manifest.baseUrl, {
    headers: { Range: `bytes=${start}-${end - 1}`, 'Accept-Encoding': 'identity' },
    cache: 'no-store',
    signal,
  })
  const expectedRange = `bytes ${start}-${end - 1}/${manifest.fileSize}`
  if (response.status !== 206 || response.headers.get('Content-Range') !== expectedRange || !response.body) {
    await response.body?.cancel()
    throw new RequestError(502, '公开权重源暂时无法返回准确的字节区间，请重试')
  }
  return response.body
}

function binaryHeaders(length, filename) {
  const headers = new Headers({ ...HEADERS, 'Content-Type': 'application/octet-stream' })
  if (length !== undefined) headers.set('Content-Length', String(length))
  if (filename) headers.set('Content-Disposition', `attachment; filename="${filename}"`)
  return headers
}

async function weightBytes(request, url, manifest) {
  const start = offset(url.searchParams.get('start'))
  const end = offset(url.searchParams.get('end'))
  if (!(start >= 0 && end > start && end <= manifest.fileSize && end - start <= MAX_SLICE_BYTES)) {
    throw new RequestError(400, '字节区间无效，或超出单次读取大小')
  }
  const body = request.method === 'HEAD' ? null : await upstreamRange(manifest, start, end, request.signal)
  return new Response(body, { headers: binaryHeaders(end - start) })
}

async function tensorDownload(request, url, env, manifest) {
  const name = url.searchParams.get('name')
  const variant = url.searchParams.get('variant') ?? 'base'
  if (!name || !Object.hasOwn(manifest.tensors, name)) throw new RequestError(404, '找不到该张量')
  if (variant !== 'base' && variant !== 'edited') throw new RequestError(400, '权重版本无效')
  const tensor = manifest.tensors[name]
  const headers = binaryHeaders(tensor.end - tensor.start, `${name}.${variant}.${tensor.dtype.toLowerCase()}.bin`)
  if (request.method === 'HEAD') return new Response(null, { headers })
  const asset = variant === 'base' ? tensor.base_asset : tensor.edited_asset
  if (asset) {
    const response = await env.ASSETS.fetch(assetRequest(request, asset))
    if (!response.ok || !response.body) throw new RequestError(503, '该张量的静态文件暂不可用')
    return new Response(response.body, { headers })
  }
  if (variant === 'edited' && tensor.patchPath) {
    const change = manifest.changes.find(item => item.name === name)
    if (!change) throw new RequestError(503, '编辑权重索引暂不可用')
    const body = await partBody(request, env, manifest, { start: tensor.start, end: tensor.end, change })
    return new Response(body, { headers })
  }
  const body = await upstreamRange(manifest, tensor.start, tensor.end, request.signal)
  return new Response(body, { headers })
}

function rangeForDownload(header, size) {
  if (!header) return { start: 0, end: size, partial: false }
  const match = /^bytes=(\d{0,10})-(\d{0,10})$/.exec(header)
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(size, Number(match[2]) + 1) : size
  return start < end && end <= size ? { start, end, partial: true } : null
}

function patchedParts(manifest, start, end) {
  const parts = []
  let cursor = start
  for (const change of [...manifest.changes].sort((a, b) => a.start - b.start)) {
    if (change.end <= cursor || change.start >= end) continue
    if (cursor < change.start) parts.push({ start: cursor, end: change.start })
    const patchStart = Math.max(cursor, change.start)
    cursor = Math.min(end, change.end)
    parts.push({ start: patchStart, end: cursor, change })
  }
  if (cursor < end) parts.push({ start: cursor, end })
  return parts
}

async function partBody(request, env, manifest, part) {
  const { start, end, change } = part
  if (!change) return upstreamRange(manifest, start, end, request.signal)
  const response = await env.ASSETS.fetch(assetRequest(request, change.path))
  if (!response.ok || !response.body) throw new RequestError(503, '编辑权重片段暂不可用')
  if (change.encoding === 'sparse-bf16-le') {
    const patch = new DataView(await response.arrayBuffer())
    if (patch.byteLength % 6) throw new RequestError(503, '编辑权重片段格式无效')
    const upstream = await upstreamRange(manifest, start, end, request.signal)
    const bytes = new Uint8Array(await new Response(upstream).arrayBuffer())
    if (bytes.length !== end - start) throw new RequestError(502, '公开权重源返回的字节数不一致')
    for (let record = 0; record < patch.byteLength; record += 6) {
      const position = change.start + patch.getUint32(record, true) * 2 - start
      if (position >= bytes.length) break
      if (position < -1) continue
      const bits = patch.getUint16(record + 4, true)
      if (position >= 0) bytes[position] = bits & 255
      if (position + 1 < bytes.length) bytes[position + 1] = bits >>> 8
    }
    return new Response(bytes).body
  }
  if (start === change.start && end === change.end) return response.body
  const bytes = await response.arrayBuffer()
  return new Response(bytes.slice(start - change.start, end - change.start)).body
}

async function editedDownload(request, env, ctx, manifest) {
  const range = rangeForDownload(request.headers.get('Range'), manifest.fileSize)
  if (!range) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${manifest.fileSize}` } })
  }
  const { start, end, partial } = range
  const headers = binaryHeaders(end - start, CHECKPOINT_NAME)
  headers.set('Accept-Ranges', 'bytes')
  if (partial) headers.set('Content-Range', `bytes ${start}-${end - 1}/${manifest.fileSize}`)
  const status = partial ? 206 : 200
  if (request.method === 'HEAD') return new Response(null, { status, headers })

  const [firstPart, ...rest] = patchedParts(manifest, start, end)
  const firstBody = await partBody(request, env, manifest, firstPart)
  if (!rest.length) return new Response(firstBody, { status, headers })
  const { readable, writable } = new FixedLengthStream(end - start)
  ctx.waitUntil((async () => {
    try {
      await firstBody.pipeTo(writable, { preventClose: true })
      for (const part of rest) {
        const body = await partBody(request, env, manifest, part)
        await body.pipeTo(writable, { preventClose: true })
      }
      await writable.close()
    } catch (error) {
      await writable.abort(error).catch(() => {})
    }
  })())
  return new Response(readable, { status, headers })
}

async function fileDownload(request, url, env, ctx, manifest) {
  const file = url.searchParams.get('file')
  if (file === `models/base/${CHECKPOINT_NAME}`) return Response.redirect(manifest.baseUrl, 302)
  if (file === `models/edited/${CHECKPOINT_NAME}`) return editedDownload(request, env, ctx, manifest)
  if (!file || !Object.hasOwn(manifest.downloads, file)) throw new RequestError(404, '文件不在公开目录')
  const path = manifest.downloads[file]
  if (path.startsWith('https://huggingface.co/Qwen/Qwen3.5-0.8B/resolve/')) return Response.redirect(path, 302)
  const response = await env.ASSETS.fetch(assetRequest(request, path, { method: request.method }))
  if (!response.ok) throw new RequestError(404, '找不到该文件')
  const headers = new Headers(response.headers)
  headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.split('/').at(-1))}`)
  headers.set('X-Content-Type-Options', 'nosniff')
  if (path.endsWith('.json.gz')) {
    headers.delete('Content-Length')
    headers.delete('Content-Encoding')
    headers.set('Content-Type', 'application/json; charset=utf-8')
    return new Response(response.body?.pipeThrough(new DecompressionStream('gzip')), { headers })
  }
  return new Response(response.body, { headers })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!['/weight-bytes', '/api/tensor.bin', '/download'].includes(url.pathname)) {
      return env.ASSETS.fetch(request)
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
    }
    try {
      const manifest = await readManifest(request, env)
      if (url.pathname === '/weight-bytes') return await weightBytes(request, url, manifest)
      if (url.pathname === '/api/tensor.bin') return await tensorDownload(request, url, env, manifest)
      return await fileDownload(request, url, env, ctx, manifest)
    } catch (error) {
      if (error instanceof RequestError) {
        return Response.json({ error: error.message }, { status: error.status, headers: HEADERS })
      }
      console.error('Weight request failed', url.pathname, error.name)
      return Response.json({ error: '权重服务暂不可用，请重试' }, { status: 502, headers: HEADERS })
    }
  },
}
