import { copyFile, mkdir } from 'node:fs/promises'

const projectRoot = new URL('../', import.meta.url)
const distRoot = new URL('../dist/', import.meta.url)

await Promise.all([
  mkdir(new URL('server/', distRoot), { recursive: true }),
  mkdir(new URL('.openai/', distRoot), { recursive: true }),
])

await Promise.all([
  copyFile(
    new URL('worker/index.js', projectRoot),
    new URL('server/index.js', distRoot),
  ),
  copyFile(
    new URL('.openai/hosting.json', projectRoot),
    new URL('.openai/hosting.json', distRoot),
  ),
])
