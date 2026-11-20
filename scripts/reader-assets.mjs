import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Both forms use the same element IDs so the reader can run online or from a file.
function readerElements(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Invalid reader template count')
  const elements = Array.from({ length: count }, (_, number) => ({
    tag: `template id="book-${number}"`,
    close: '</template>',
    file: `chapters/${number}.html`,
  }))
  elements.push({ tag: 'script id="full-index" type="application/json"', close: '</script>', file: 'chapters/search.json' })
  return elements.map(({ tag, close, file }) => ({
    open: `<${tag}>`,
    placeholder: `<${tag} data-src="./${file}">${close}`,
    close,
    file,
  }))
}

export function splitReaderAssets(html, count) {
  const files = new Map()
  for (const { open, close, placeholder, file } of readerElements(count)) {
    const start = html.indexOf(open)
    const contentStart = start + open.length
    const end = html.indexOf(close, contentStart)
    if (start < 0 || end < 0 || html.indexOf(open, contentStart) !== -1) {
      throw new Error(`Expected one complete reader element: ${open}`)
    }
    const content = html.slice(contentStart, end)
    if (!content.trim()) throw new Error(`Empty reader asset: ${file}`)
    files.set(file, content)
    html = html.slice(0, start) + placeholder + html.slice(end + close.length)
  }
  if (/<template id="book-\d+">/.test(html)) throw new Error('Unexpected additional reader chapter')
  return { html, files }
}

export async function restoreReaderAssets(html, count, directory) {
  for (const { open, close, placeholder, file } of readerElements(count)) {
    // A previously published standalone snapshot may already contain the element.
    if (!html.includes(placeholder)) continue
    const content = await readFile(path.join(directory, file), 'utf8')
    html = html.replace(placeholder, () => open + content + close)
  }
  return html
}
