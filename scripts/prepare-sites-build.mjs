import { mkdir, writeFile } from 'node:fs/promises'

const worker = `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)

    if (response.status !== 404) {
      return response
    }

    return env.ASSETS.fetch(
      new Request(new URL('/index.html', request.url), {
        headers: request.headers,
      }),
    )
  },
}

export default worker
`

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true })
await writeFile(new URL('../dist/server/index.js', import.meta.url), worker)
