import { readFile, rm, writeFile } from 'node:fs/promises'

const distIndexUrl = new URL('../dist/index.html', import.meta.url)
const ssrDirectoryUrl = new URL('../dist-ssr/', import.meta.url)
const ssrEntryUrl = new URL('../dist-ssr/entry-server.js', import.meta.url)

const [{ render }, template] = await Promise.all([
  import(ssrEntryUrl.href),
  readFile(distIndexUrl, 'utf8'),
])

const placeholder = '<div id="root"></div>'
if (!template.includes(placeholder)) {
  throw new Error('Unable to find the root placeholder in dist/index.html')
}

const html = template.replace(placeholder, `<div id="root">${render()}</div>`)
await writeFile(distIndexUrl, html)
await rm(ssrDirectoryUrl, { recursive: true, force: true })
