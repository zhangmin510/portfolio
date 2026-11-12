import { decoratePanorama } from '../../scripts/navigation/render.mjs'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
export const outputPath = path.resolve(directory, '../../public/panoramas/eval-quest/index.html')
const names = ['MISSIONS', 'BOOK', 'FIGURES', 'GLOSSARY', 'SOURCE_MANIFEST']
const serialize = (value) => JSON.stringify(value)
  .replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')

export function validatePublicData(data) {
  if (data.MISSIONS.length !== 12 || data.MISSIONS.reduce((n, m) => n + m.qs.length, 0) !== 24) {
    throw new Error('Expected 12 missions and 24 questions')
  }
  if (Object.keys(data.BOOK).length !== 18 || Object.keys(data.FIGURES).length !== 14) {
    throw new Error('Expected 18 book documents and 14 original figures')
  }
  for (const mission of data.MISSIONS) {
    if (!data.BOOK[String(mission.id).padStart(2, '0')] || !data.FIGURES[mission.figure]) {
      throw new Error(`Missing mission source: ${mission.id}`)
    }
  }
  for (const doc of Object.values(data.BOOK)) {
    if (!/^\d{2}$/.test(doc.id) || /<script\b|<iframe\b|\son\w+\s*=|(?:href|src)=["']javascript:/i.test(doc.html)) {
      throw new Error(`Unsafe book document: ${doc.id}`)
    }
  }
  for (const figure of Object.values(data.FIGURES)) {
    if (!figure.src.startsWith('data:image/svg+xml;base64,')) throw new Error('Figure must be embedded SVG')
    const svg = Buffer.from(figure.src.split(',')[1], 'base64').toString('utf8')
    if (/<script|<foreignObject|\son\w+\s*=|(?:href|src)=["'](?:https?:|\/\/)/i.test(svg)) {
      throw new Error('Executable or externally loaded SVG is not permitted')
    }
  }
}

export function validatePublicText(text) {
  if (/obsidian:\/\/|file:\/\/|\/Users\/|note\/评测|note\/深度|10xAI Vault|(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{24,}/i.test(text)) {
    throw new Error('Private path, local-only link, or credential-like value in public edition')
  }
}

export async function renderPage() {
  const [template, styles, app, rawData] = await Promise.all(
    ['template.html', 'styles.css', 'app.js', 'data.json'].map((name) => readFile(path.join(directory, name), 'utf8')),
  )
  const data = JSON.parse(rawData)
  validatePublicData(data)
  const replacements = {
    '/*__EVAL_STYLES__*/': styles,
    '/*__EVAL_DATA__*/': names.map((name) => `var ${name}=${serialize(data[name])};`).join('\n'),
    '/*__EVAL_APP__*/': app,
  }
  let html = template
  for (const [marker, value] of Object.entries(replacements)) {
    if (html.split(marker).length !== 2) throw new Error(`Expected exactly one template marker: ${marker}`)
    // A replacer function preserves literal dollar sequences in learning content.
    html = html.replace(marker, () => value)
  }
  validatePublicText(html)
  const manifest = JSON.parse(await readFile(path.resolve(directory, '../../scripts/panoramas.json'), 'utf8'))
  return decoratePanorama(html, manifest.pages.find(p => p.slug === 'eval-quest'), manifest.pages)
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  const html = await renderPage()
  if (process.argv.includes('--check')) {
    if (await readFile(outputPath, 'utf8') !== html) throw new Error('Eval Quest snapshot is stale; run npm run build:eval-quest')
    console.log('Verified Eval Quest public snapshot')
  } else {
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)
    console.log(`Built Eval Quest: ${Buffer.byteLength(html)} bytes, 12 missions, 18 documents, 14 figures`)
  }
}
