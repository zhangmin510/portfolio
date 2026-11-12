import { decoratePanorama, stripNavigation, navigation, css } from './navigation/render.mjs'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Canonical sources are relative to portfolio/, never to a user Downloads folder.
// A clean portfolio checkout can recover the originals from its published copies:
// undoing only our vendor-src substitutions restores their recorded SHA-256.
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(projectDir, 'scripts/panoramas.json')
const manifestText = await readFile(manifestPath, 'utf8')
const manifest = JSON.parse(manifestText)
const check = process.argv.includes('--check')
const outputDir = path.join(projectDir, 'public/panoramas')
const errors = []
let restored = 0

if (manifest.version !== 1 || manifest.basePath !== '/panoramas/') {
  throw new Error('Unsupported panorama manifest version or basePath')
}
const slugs = new Set()
for (const page of manifest.pages) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) || slugs.has(page.slug)) {
    throw new Error(`Invalid or repeated panorama slug: ${page.slug}`)
  }
  if (!page.title || !page.description || !page.category || !page.source) {
    throw new Error(`Incomplete panorama entry: ${page.slug}`)
  }
  slugs.add(page.slug)
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const exists = async (file) => access(file).then(() => true, () => false)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function replaceScriptSrc(html, from, to) {
  const pattern = new RegExp(`(<script\\b[^>]*?\\bsrc\\s*=\\s*)(["'])${escapeRegExp(from)}\\2`, 'gi')
  return html.replace(pattern, (_match, prefix, quote) => `${prefix}${quote}${to}${quote}`)
}

const exportPrefix = `(["']<!DOCTYPE html>\\\\n["']\\s*\\+\\s*)`
const exportExpression = '(clone\\.outerHTML|document\\.documentElement\\.outerHTML)'
const exportReplacements = manifest.vendors.map((vendor) => (
  `.replaceAll(${JSON.stringify(`${manifest.basePath}vendor/${vendor.file}`)}, ${JSON.stringify(vendor.url)})`
)).join('')

function preserveStandaloneDownloads(html) {
  // Match only the authored doctype + document serialization used by HTML
  // download functions. Minified libraries and other outerHTML uses are untouched.
  const pattern = new RegExp(`${exportPrefix}${exportExpression}`, 'g')
  return html.replace(pattern, (_match, prefix, expression) => (
    `${prefix}(${expression})${exportReplacements}`
  ))
}

function restoreDownloadExpressions(html) {
  const pattern = new RegExp(`${exportPrefix}\\(${exportExpression}\\)${escapeRegExp(exportReplacements)}`, 'g')
  return html.replace(pattern, (_match, prefix, expression) => `${prefix}${expression}`)
}

function localize(html) {
  const localized = manifest.vendors.reduce((result, vendor) => replaceScriptSrc(
    result, vendor.url, `${manifest.basePath}vendor/${vendor.file}`,
  ), html)
  return preserveStandaloneDownloads(localized)
}

function restoreOriginal(html) {
  html = stripNavigation(html)
  return manifest.vendors.reduce((result, vendor) => replaceScriptSrc(
    result, `${manifest.basePath}vendor/${vendor.file}`, vendor.url,
  ), restoreDownloadExpressions(html))
}

async function saveOrCheck(file, expected) {
  const current = await readFile(file).catch(() => null)
  const bytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected)
  if (current?.equals(bytes)) return
  if (check) {
    errors.push(`${path.relative(projectDir, file)} is missing or out of date`)
    return
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, bytes)
}

for (const vendor of manifest.vendors) {
  if (!/^[a-zA-Z0-9.-]+\.js$/.test(vendor.file)) throw new Error(`Invalid vendor filename: ${vendor.file}`)
  const destination = path.join(outputDir, 'vendor', vendor.file)
  let bytes = await readFile(destination).catch(() => null)
  if (!bytes || hash(bytes) !== vendor.sha256) {
    if (check) {
      errors.push(`Vendor checksum mismatch or missing file: ${vendor.file}`)
      continue
    }
    bytes = vendor.source ? await readFile(path.resolve(projectDir, vendor.source)).catch(() => null) : null
    if (!bytes || hash(bytes) !== vendor.sha256) {
      const response = await fetch(vendor.url, { signal: AbortSignal.timeout(30000) })
      if (!response.ok) throw new Error(`Cannot download ${vendor.url}: HTTP ${response.status}`)
      bytes = Buffer.from(await response.arrayBuffer())
    }
    if (hash(bytes) !== vendor.sha256) throw new Error(`Downloaded vendor checksum mismatch: ${vendor.file}`)
    await saveOrCheck(destination, bytes)
  }
}

for (const page of manifest.pages) {
  const destination = path.join(outputDir, page.slug, 'index.html')
  const sourcePath = path.resolve(projectDir, page.source)
  let source
  if (await exists(sourcePath)) {
    source = stripNavigation(await readFile(sourcePath, 'utf8'))
  } else {
    source = restoreOriginal(await readFile(destination, 'utf8').catch(() => {
      throw new Error(`Both source and published snapshot are missing for ${page.slug}: ${sourcePath}`)
    }))
    if (!page.sourceSha256 || hash(source) !== page.sourceSha256) {
      throw new Error(`Published snapshot does not restore the recorded source for ${page.slug}`)
    }
    restored += 1
  }
  const sourceSha256 = hash(source)
  if (check && page.sourceSha256 !== sourceSha256) {
    errors.push(`Source checksum changed for ${page.slug}; run the sync command`)
  }
  page.sourceSha256 = sourceSha256
  await saveOrCheck(destination, decoratePanorama(localize(source), page, manifest.pages))
}

const categories = [...new Set(manifest.pages.map((page) => page.category))]
const colors = ['#81d5b8', '#e9c384', '#a7bafa', '#d5aeec', '#ebaabd']
const colorsByCategory = new Map(categories.map((category, index) => [category, colors[index % colors.length]]))
const cards = manifest.pages.map((page, index) => {
  const search = [page.title, page.subtitle, page.description, page.category, ...page.tags, page.slug].join(' ')
  return `<a class="card" href="${manifest.basePath}${page.slug}/" data-category="${escapeHtml(page.category)}" data-search="${escapeHtml(search)}" style="--card-accent:${colorsByCategory.get(page.category)}">
      <div class="card-top"><span class="card-category">${escapeHtml(page.category)}</span><span class="card-number">${String(index + 1).padStart(2, '0')}</span></div>
      <h2>${escapeHtml(page.title)}</h2>
      <p class="card-subtitle">${escapeHtml(page.subtitle)}</p>
      <p class="card-description">${escapeHtml(page.description)}</p>
      <div class="tags">${page.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="card-bottom"><time datetime="${page.updatedAt}">${page.updatedAt.replaceAll('-', '.')}</time><span class="card-link">打开全景 <span aria-hidden="true">→</span></span></div>
    </a>`
}).join('\n')

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>全景图 · ZhangMin.name</title>
  <meta name="description" content="张敏的交互式全景图合集：大模型、训练、Agent、联网搜索、AI 评测、算力、产业与成长观察。">
  <link rel="canonical" href="https://zhangmin.name/panoramas/">
  <link rel="icon" href="/favicon-32.png" type="image/png">
  <meta property="og:title" content="全景图 · ZhangMin.name">
  <meta property="og:description" content="${manifest.pages.length} 张交互式全景图，把知识展开来看。">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://zhangmin.name/panoramas/">
  <style>
${css}
    :root{color-scheme:dark;--bg:#0d1117;--surface:#141b23;--text:#e4eaf1;--muted:#97a7b8;--line:#283441;--mint:#81d5b8;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}button,input{font:inherit}button{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--mint);outline-offset:5px}::selection{background:var(--mint);color:var(--bg)}.wrap{width:min(1180px,calc(100% - 64px));margin:auto}
    .masthead{display:flex;align-items:center;justify-content:space-between;padding:27px 0;border-bottom:1px solid var(--line);font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.brand{font-weight:700;letter-spacing:.03em}.brand i{font-style:normal;color:var(--mint)}.home{color:var(--muted);transition:color .2s}.home:hover{color:var(--text)}.home span{margin-right:8px}
    .hero{position:relative;display:grid;grid-template-columns:1.4fr 1fr;align-items:end;gap:50px;padding:76px 0 59px}.hero:before{content:"";position:absolute;pointer-events:none;right:5%;top:22px;width:250px;height:250px;background:radial-gradient(circle,rgba(129,213,184,.09),transparent 70%)}.eyebrow{display:flex;align-items:center;gap:10px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:var(--mint);margin:0 0 21px}.eyebrow:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--mint)}h1{font-size:clamp(48px,6.5vw,78px);line-height:1.16;letter-spacing:-.055em;margin:0;font-weight:700}h1 span{display:block;color:var(--mint);font-size:.52em;letter-spacing:-.02em;margin-top:13px}.intro{max-width:390px;justify-self:end;margin-bottom:3px}.intro p{color:var(--muted);margin:0;font-size:15px;line-height:1.95}.stats{display:flex;gap:28px;margin-top:25px}.stat{display:flex;align-items:baseline;gap:7px}.stat strong{font:26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--text)}.stat span{font-size:12px;color:var(--muted)}
    .tools{border-top:1px solid var(--line);padding:26px 0 23px;display:grid;grid-template-columns:1fr 265px;gap:20px;align-items:start}.filters{display:flex;flex-wrap:wrap;gap:8px}.filter{border:1px solid var(--line);padding:8px 13px;border-radius:7px;background:transparent;color:var(--muted);font-size:12px;line-height:1.5;white-space:nowrap;transition:border-color .2s,background .2s,color .2s}.filter:hover{border-color:#526574;color:var(--text)}.filter[aria-pressed="true"]{color:var(--bg);background:var(--mint);border-color:var(--mint);font-weight:600}.filter small{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;margin-left:5px;opacity:.68}.searchbox{position:relative;display:block}.searchbox svg{position:absolute;width:16px;height:16px;top:13px;left:13px;color:var(--muted);pointer-events:none}.searchbox input{width:100%;padding:10px 35px 10px 38px;background:var(--surface);border:1px solid var(--line);border-radius:7px;color:var(--text);font-size:12px;line-height:1.5}.searchbox input::placeholder{color:#8292a3}.searchbox input:focus{border-color:var(--mint);outline:2px solid rgba(129,213,184,.3);outline-offset:2px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.result-line{display:flex;justify-content:space-between;align-items:center;margin:0 0 20px;color:var(--muted);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.result-line span:last-child{color:#6f8496}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}.card{display:flex;flex-direction:column;min-height:319px;padding:24px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(160deg,#161e28,var(--surface) 75%);transition:transform .2s,border-color .2s,background .2s}.card:hover{transform:translateY(-4px);border-color:var(--card-accent);background:linear-gradient(160deg,#1b2732,var(--surface) 75%)}.card-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:24px}.card-category{font-size:11px;color:var(--card-accent)}.card-number{font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#647587}.card h2{font-size:21px;line-height:1.35;letter-spacing:-.035em;margin:0 0 7px;font-weight:650}.card-subtitle{font-size:12px;line-height:1.6;color:var(--card-accent);margin:0 0 16px}.card-description{font-size:13px;line-height:1.9;color:var(--muted);margin:0 0 19px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin:auto 0 20px}.tags span{font-size:10px;line-height:1.5;color:#a0afbf;padding:4px 7px;border:1px solid #2a3541;border-radius:4px}.card-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:15px;border-top:1px solid var(--line)}.card-bottom time{font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#728497}.card-link{font-size:11px;color:var(--text)}.card-link span{display:inline-block;margin-left:6px;color:var(--card-accent);transition:transform .2s}.card:hover .card-link span{transform:translate(2px,-2px)}[hidden]{display:none!important}.empty{text-align:center;padding:80px 20px;border:1px dashed var(--line);border-radius:12px;color:var(--muted)}.empty h2{font-size:21px;color:var(--text);margin:0 0 9px}.empty p{margin:0 0 20px;font-size:13px}.reset{background:var(--mint);border:0;border-radius:6px;padding:10px 16px;color:var(--bg);font-size:12px}.footer{display:flex;justify-content:space-between;gap:20px;align-items:center;border-top:1px solid var(--line);margin-top:45px;padding:25px 0 32px;color:#728497;font-size:11px}.footer a{color:var(--muted)}.footer a:hover{color:var(--mint)}
    @media(max-width:1050px){.tools{grid-template-columns:1fr}.searchbox{max-width:400px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hero{gap:30px}.intro p{font-size:14px}}
    @media(max-width:650px){.wrap{width:calc(100% - 36px)}.masthead{padding:21px 0;font-size:12px}.hero{grid-template-columns:1fr;padding:45px 0 35px;gap:24px}.hero:before{right:-15px;top:15px;width:180px;height:180px}h1{font-size:53px}.eyebrow{margin-bottom:17px;font-size:10px}.intro{justify-self:start;max-width:100%}.intro p{max-width:410px}.stats{margin-top:18px;gap:24px}.stat strong{font-size:22px}.tools{padding:21px 0 18px;gap:15px}.filter{padding:8px 11px;font-size:11px}.searchbox{max-width:none}.result-line{font-size:10px;margin-bottom:15px}.grid{grid-template-columns:1fr;gap:13px}.card{min-height:300px;padding:23px}.card-top{margin-bottom:21px}.card h2{font-size:23px}.card-description{font-size:13px}.footer{margin-top:32px;align-items:start;flex-direction:column;gap:6px}.empty{padding:60px 20px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}.card:hover{transform:none}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="masthead"><a class="brand" href="/">ZhangMin<i>.name</i></a>${navigation({slug:"panoramas"})}</header>
    <main>
      <section class="hero" aria-labelledby="page-title">
        <div><p class="eyebrow">THE PANORAMA COLLECTION</p><h1 id="page-title">全景图<span>把知识，展开来看。</span></h1></div>
        <div class="intro"><p>从模型训练到 Agent，从产业版图到成长观察。<br>用可探索的图谱，梳理复杂主题中的脉络与联系。</p><div class="stats"><div class="stat"><strong>${manifest.pages.length}</strong><span>交互图谱</span></div><div class="stat"><strong>${categories.length}</strong><span>主题方向</span></div></div></div>
      </section>
      <section aria-label="全景图目录">
        <div class="tools">
          <div class="filters" aria-label="按主题筛选"><button class="filter" type="button" data-category="" aria-pressed="true">全部<small>${manifest.pages.length}</small></button>${categories.map((category) => `<button class="filter" type="button" data-category="${escapeHtml(category)}" aria-pressed="false">${escapeHtml(category)}<small>${manifest.pages.filter((page) => page.category === category).length}</small></button>`).join('')}</div>
          <label class="searchbox"><span class="sr-only">搜索全景图</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg><input id="search" type="search" placeholder="搜索标题、主题或关键词" autocomplete="off"></label>
        </div>
        <p class="result-line"><span id="result-count" role="status" aria-live="polite">展示 ${manifest.pages.length} / ${manifest.pages.length} 张全景图</span><span>最近更新 ${manifest.updatedAt.replaceAll('-', '.')}</span></p>
        <div class="grid" id="gallery">
          ${cards}
        </div>
        <div class="empty" id="empty" hidden><h2>没有找到匹配的全景图</h2><p>试试其他关键词，或浏览全部主题。</p><button type="button" class="reset" id="reset">查看全部全景图</button></div>
        <noscript><p>所有全景图已列于上方。开启 JavaScript 后可使用搜索和主题筛选。</p></noscript>
      </section>
    </main>
    <footer class="footer"><span>© 2026 ZhangMin.name · 持续记录与探索</span><a href="/">个人主页 <span aria-hidden="true">←</span></a></footer>
  </div>
  <script src="/panoramas/directory.js" defer></script>
</body>
</html>
`

await saveOrCheck(path.join(outputDir, 'index.html'), html)
if (!check) await saveOrCheck(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`${check ? 'Verified' : 'Synced'} ${manifest.pages.length} panoramas, ${manifest.vendors.length} pinned vendors, and directory index${restored ? ` (${restored} sources restored from published snapshots)` : ''}.`)
}
