const $ = (id) => document.getElementById(id)
const markets = { CN: 'A 股', HK: '港股', US: '美股' }
const sectors = {
  chips: ['半导体与制造', '芯片设计、晶圆制造、设备、封装与存储'],
  infra: ['能源、机房与互连', '发电与配电、液冷机房、光通信与交换网络'],
  compute: ['服务器与算力', '计算整机、加速集群、云与算力租赁'],
  models: ['模型与平台', '基础模型、多模态、训练及开发平台'],
  services: ['数据与技术服务', '数据治理、标注、咨询、集成与交付'],
  software: ['应用软件', '智能体、企业软件及各行业的 AI 应用'],
  devices: ['智能终端', '手机、AI PC、可穿戴设备与边缘感知'],
  robotics: ['机器人与智驾', '工业自动化、具身智能与智能驾驶'],
  mixed: ['综合及待细分', '主题成分或跨环节业务'],
}
const stages = [
  { name: '硬件与算力', en: 'COMPUTE', ids: ['chips', 'infra', 'compute'], icon: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M8 2v3m4-3v3m4-3v3M8 19v3m4-3v3m4-3v3M2 8h3m-3 4h3m-3 4h3m14-8h3m-3 4h3m-3 4h3"/><rect x="9" y="9" width="6" height="6"/>' },
  { name: '模型、数据与软件', en: 'INTELLIGENCE', ids: ['models', 'services', 'software'], icon: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>' },
  { name: '终端与机器', en: 'PHYSICAL AI', ids: ['devices', 'robotics'], icon: '<path d="M4 20h13M6 18l3-8m2-2 7-4m0 3-4 5 3 3m1-1 2 2"/><circle cx="10" cy="8" r="2.5"/><circle cx="18.5" cy="4.5" r="2"/><path d="M5 19h6"/>' },
]
const kinds = { company: '公司披露', index: '指数成分', fund: '基金持仓', theme: '主题资料', exchange: '上市名录', other: '其他资料' }
const pageSize = 18
let blocks = []
let records = []
let filtered = []
let active = {}
let page = 1
let lastTrigger = null
const byKey = new Map()
const products = new Map()
const fundState = { q:'', market:'', type:'', page:1 }
const productType = { etf:'ETF', index:'指数' }
const count = n => n.toLocaleString('zh-CN')
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const fold = v => String(v).normalize('NFKC').toLowerCase().replace(/人工智能/g, 'ai').trim()
const option = (value, label) => '<option value="' + esc(value) + '">' + esc(label) + '</option>'
const external = (url, label) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>'
const sectorOptions = Object.entries(sectors).map(([key, [label]]) => option(key, label)).join('')
const queryKeys = ['market', 'sector', 'segment', 'evidence', 'q', 'members']
function readState() {
  const p = new URLSearchParams(location.search)
  active = Object.fromEntries(queryKeys.map(key => [key, p.get(key) || '']))
  if (!Object.hasOwn(markets, active.market)) active.market = ''
  if (!Object.hasOwn(sectors, active.sector)) active.sector = ''
  if (!['company', 'lists'].includes(active.evidence)) active.evidence = ''
  page = Math.max(1, Math.floor(Number(p.get('page'))) || 1)
}
function updateUrl(anchor = location.hash, push = false) {
  const url = new URL(location.href)
  for (const key of queryKeys) {
    if (active[key]) url.searchParams.set(key, active[key])
    else url.searchParams.delete(key)
  }
  if (page > 1) url.searchParams.set('page', page)
  else url.searchParams.delete('page')
  url.hash = anchor
  history[push ? 'pushState' : 'replaceState'](null, '', url)
}
function countsFor(rows, field) {
  const totals = new Map()
  for (const r of rows) totals.set(r[field], (totals.get(r[field]) || 0) + 1)
  return totals
}
function renderOverview() {
  const marketTotals = countsFor(records, 'market')
  $('metrics').innerHTML = [['', '收录证券记录', records.length], ...Object.entries(markets).map(([key, name]) => [key, name + '记录', marketTotals.get(key)])]
    .map(([k, label, n]) => '<button type="button" class="metric" data-go-market="' + k + '"><span>' + label + '</span><strong>' + count(n || 0) + '</strong></button>').join('')
  const sectorTotals = countsFor(records, 'sector')
  $('chain-grid').innerHTML = stages.map(stage => {
    const rows = stage.ids.map(key => '<button type="button" class="node" data-go-sector="' + key + '"><strong>' + sectors[key][0] + '</strong><em>' + count(sectorTotals.get(key) || 0) + '</em><small>' + sectors[key][1] + '</small></button>').join('')
    return '<article class="stage"><div class="stage-top"><span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">' + stage.icon + '</svg></span><div><small>' + stage.en + '</small><h3>' + stage.name + '</h3></div></div><div class="stage-list">' + rows + '</div></article>'
  }).join('')
  const mixed = sectorTotals.get('mixed') || 0
  $('unclassified').innerHTML = mixed ? '<p class="unclassified-note">另有 <button type="button" class="mixed-link" data-go-sector="mixed">' + count(mixed) + ' 条综合及待细分记录</button>，可在名录中查看各自的收录理由。</p>' : ''
  const shortcuts = ['先进封装','HBM','光模块','液冷','训练数据','智能体','AI制药','人形机器人']
  $('shortcuts').innerHTML = '<span>查细分</span>' + shortcuts.filter(q => records.some(r => r.search.includes(fold(q)))).map(q => '<button type="button" data-topic="' + esc(q) + '">' + esc(q) + '</button>').join('')
  $('sector').innerHTML = option('', '全部产业环节') + sectorOptions
  $('markets').innerHTML = [['', '全部市场'], ...Object.entries(markets)].map(([k, label]) => '<button type="button" data-market="' + k + '">' + label + '</button>').join('')
}
function renderMatrix() {
  const totals = countsFor(records, 'market')
  const cells = new Map()
  for (const r of records) {
    const key = r.market + '/' + r.sector
    cells.set(key, (cells.get(key) || 0) + 1)
  }
  const columns = Object.entries(markets)
  const body = Object.entries(sectors).map(([key, [label]]) => {
    const values = columns.map(([m, marketName]) => {
      const n = cells.get(m + '/' + key) || 0
      const share = n / (totals.get(m) || 1)
      const pct = (share * 100).toFixed(1) + '%'
      return '<td><button type="button" data-cell-market="' + m + '" data-cell-sector="' + key + '" style="--fill:' + Math.min(90, 7 + 110 * share) + '%" aria-label="' + marketName + ' · ' + label + ' · ' + n + ' 条，占' + pct + '"><strong>' + count(n) + '</strong><small>' + pct + '</small></button></td>'
    }).join('')
    return '<tr><th scope="row">' + label + '</th>' + values + '</tr>'
  }).join('')
  $('matrix').innerHTML = '<p class="matrix-note">每格列出证券数及其占该市场收录记录的比例。点击数字可查看对应证券。</p><table><thead><tr><th scope="col">产业环节</th>' + columns.map(([,name]) => '<th scope="col">' + name + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>'
}
function setMap(view) {
  $('chain-grid').hidden = view !== 'chain'
  $('unclassified').hidden = view !== 'chain'
  $('matrix').hidden = view !== 'matrix'
  document.querySelectorAll('[data-map]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.map === view)))
}
function sourceItem(s) {
  return '<div class="source-item">' + external(s.url, s.title) + '<small>' + esc(kinds[s.kind] || '资料') + ' · ' + esc(s.asOf) + '</small>' + (s.scope ? '<p class="source-scope">' + esc(s.scope) + '</p>' : '') + '</div>'
}
function renderSources() {
  const issuers = new Set(records.map(r => r.group || r.key))
  $('issuer-count').textContent = '按已核实的同一发行人关系合并，' + count(records.length) + ' 条证券记录对应 ' + count(issuers.size) + ' 组发行人。'
  $('source-lists').innerHTML = blocks.map(block => {
    const primary = block.sources.filter(s => s.kind === 'company')
    const lists = block.sources.filter(s => s.kind !== 'company')
    const method = (Array.isArray(block.methodology) ? block.methodology : [block.methodology]).filter(s => typeof s === 'string')
    return '<details class="source-group"><summary>' + markets[block.market] + '<small>' + count(block.companies.length) + ' 条记录 · 整理于 ' + esc(block.asOf) + '</small></summary><div class="source-list-inner">' + method.map(s => '<p class="source-detail">' + esc(s) + '</p>').join('') + lists.map(sourceItem).join('') + (primary.length ? '<details class="company-source-group"><summary>公司产品与披露文件（' + primary.length + '）</summary>' + primary.map(sourceItem).join('') + '</details>' : '') + '</div></details>'
  }).join('')
}
function renderRecord(r) {
  return '<button type="button" class="record" data-open="' + esc(r.key) + '"><span class="identity"><strong>' + esc(r.displayName) + '</strong><small>' + esc(r.ticker + (r.displayName !== r.name ? ' · ' + r.name : '')) + '</small></span><span class="venue">' + markets[r.market] + '<small>' + esc(r.venue) + '</small></span><span class="sector-label">' + sectors[r.sector][0] + '<small class="segment-text">' + esc((r.segments || []).slice(0, 2).join(' · ')) + '</small></span><span class="basis' + (r.direct ? ' direct' : '') + '">' + (r.direct ? '有公司披露' : '主题与名单') + '</span><span class="chev" aria-hidden="true">›</span></button>'
}
function renderResults() {
  const words = fold(active.q).split(/\s+/).filter(Boolean)
  const memberFilter = products.get(active.members)
  const base = records.filter(r => (!memberFilter || memberFilter.members.has(r.key)) && (!active.market || r.market === active.market) && (!active.sector || r.sector === active.sector) && (!active.evidence || (active.evidence === 'company') === r.direct) && words.every(w => r.search.includes(w)))
  const segmentCounts = new Map()
  for (const row of base) for (const s of row.segments || []) segmentCounts.set(s, (segmentCounts.get(s) || 0) + 1)
  if (active.segment && !segmentCounts.has(active.segment)) segmentCounts.set(active.segment, 0)
  $('segment').innerHTML = option('', '全部细分主题') + [...segmentCounts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh')).map(([s,n]) => option(s, s + '（' + n + '）')).join('')
  filtered = active.segment ? base.filter(r => r.segments?.includes(active.segment)) : base
  if (words.length) {
    const term = fold(active.q)
    const rank = r => {
      if (fold(r.ticker) === term) return 0
      if (r.exact.has(term)) return 1
      return fold(r.name).startsWith(term) || fold(r.ticker).startsWith(term) ? 2 : 3
    }
    filtered.sort((a,b) => rank(a) - rank(b))
  }
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  page = Math.min(page, pages)
  $('sector').value = active.sector
  $('segment').value = active.segment
  $('evidence').value = active.evidence
  if ($('query').value !== active.q) $('query').value = active.q
  document.querySelectorAll('[data-market]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.market === active.market)))
  $('results').textContent = (memberFilter ? memberFilter.name + ' · ' : '') + '匹配 ' + count(filtered.length) + ' / ' + count(records.length) + ' 条证券记录'
  $('download').disabled = !filtered.length
  $('list').innerHTML = filtered.length ? filtered.slice((page-1)*pageSize, page*pageSize).map(renderRecord).join('') : '<div class="empty"><p>当前条件下没有匹配的记录。</p><button class="text-button" data-reset type="button">清除条件，查看全部</button></div>'
  $('pager').innerHTML = pages > 1 ? '<button type="button" data-page="-1"' + (page === 1 ? ' disabled' : '') + '>上一页</button><span>' + page + ' / ' + pages + '</span><button type="button" data-page="1"' + (page === pages ? ' disabled' : '') + '>下一页</button>' : ''
}
function reset(partial = {}) {
  active = { market:'', sector:'', segment:'', evidence:'', q:'', members:'', ...partial }
  page = 1
  renderResults()
}
function explore(partial) {
  reset(partial)
  updateUrl('#directory', true)
  $('directory').scrollIntoView()
}
function showProfile(key, trigger) {
  const row = byKey.get(key)
  if (!row) return false
  if (trigger) lastTrigger = trigger
  $('profile-kind').textContent = '公司档案'
  const tags = [sectors[row.sector][0], row.relationship, ...(row.segments || [])].filter(Boolean)
  const peers = row.group ? records.filter(r => r.group === row.group && r.key !== row.key) : []
  const links = []
  if (row.evidenceUrl && !row.refs.some(s => s.url === row.evidenceUrl)) links.push(external(row.evidenceUrl, row.evidenceLabel || '查看该证券的收录原文'))
  if (row.profileUrl && row.profileUrl !== row.evidenceUrl && !row.refs.some(s => s.url === row.profileUrl)) links.push(external(row.profileUrl, '查看公司档案'))
  $('profile-content').innerHTML = '<h2 id="profile-title">' + esc(row.name) + '</h2><p class="ticker-line">' + esc(row.ticker) + ' · ' + esc(row.venue) + ' · ' + markets[row.market] + '</p><div class="badges">' + [...new Set(tags)].map(t => '<span>' + esc(t) + '</span>').join('') + '</div><h3>产业链关联</h3><p class="detail">' + esc(row.detail) + '</p>' + (row.aliases?.length ? '<p class="meta">其他名称　' + esc(row.aliases.join(' / ')) + '</p>' : '') + (peers.length ? '<h3>同一发行人的其他收录代码</h3>' + peers.map(r => '<button type="button" class="other-listing" data-open="' + esc(r.key) + '">' + markets[r.market] + ' · ' + esc(r.ticker) + '</button>').join('') : '') + '<h3>收录依据</h3>' + links.map(l => '<p class="source-detail">' + l + '</p>').join('') + row.refs.map(sourceItem).join('')
  const funds = [...products.values()].filter(p => p.members.has(row.key))
  if (funds.length) {
    $('profile-content').insertAdjacentHTML('beforeend','<h3>关联 ETF 与指数</h3><p class="fund-note">依据已对照的持仓或指数成分，可点开核对跟踪关系。</p>' + funds.map(fundButton).join(''))
  }
  if (!$('profile').open) $('profile').showModal()
  $('profile').scrollTop = 0
  return true
}
function syncLocation() {
  readState()
  renderResults()
  const params = new URLSearchParams(location.search)
  const fund = params.get('instrument')
  if (fund && showFund(fund)) return
  const key = params.get('listing')
  if (key && showProfile(key)) return
  if ($('profile').open) $('profile').close()
}
function openProfile(key, trigger) {
  if (!showProfile(key, trigger)) return
  const url = new URL(location.href)
  url.searchParams.delete('instrument')
  url.searchParams.set('listing', key)
  history.pushState(null, '', url)
}
function exportCsv() {
  const cell = value => {
    let content = String(value ?? '')
    if (/^[=+@\-\t\r]/.test(content)) content = "'" + content
    return '"' + content.replaceAll('"','""') + '"'
  }
  const header = ['市场','上市场所','证券代码','公司名称','产业环节','细分主题','产业链关联','收录依据','来源链接']
  const rows = filtered.map(r => [markets[r.market],r.venue,r.ticker,r.name,sectors[r.sector][0],r.segments?.join(' / '),r.detail,r.refs.map(s => s.title).join(' / '),[...new Set([r.evidenceUrl,...r.refs.map(s => s.url)].filter(Boolean))].join(' ')])
  const blob = new Blob(['\uFEFF' + [header,...rows].map(row => row.map(cell).join(',')).join('\r\n')], { type:'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'ai-equity-atlas-' + (active.market || 'all') + '.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function fundButton(p) {
  return '<button type="button" class="product-link" data-fund="' + esc(p.key) + '">' + esc(p.code + ' · ' + p.name) + '</button>'
}

function prepareFunds(instruments) {
  const sourceMap = new Map(blocks.flatMap(b => b.sources.map(s => [b.market + '/' + s.id, s])))
  const membersByUrl = new Map()
  for (const r of records) {
    if (r.linkedFrom) continue
    for (const source of r.refs.filter(s => ['index','fund'].includes(s.kind) && !r.excludedMemberSources?.includes(s.id))) {
      const key = source.url + '|' + source.asOf
      if (!membersByUrl.has(key)) membersByUrl.set(key, new Set())
      membersByUrl.get(key).add(r.key)
    }
  }
  for (const fund of instruments) {
    const key = fund.market + '-' + fund.type + '-' + fund.code
    const memberRefs = (fund.memberSources || []).map(id => sourceMap.get(fund.market + '/' + id)).filter(Boolean)
    const members = new Set(memberRefs.flatMap(ref => [...(membersByUrl.get(ref.url + '|' + ref.asOf) || [])]))
    for (const ticker of fund.memberTickers || []) {
      const listing = fund.market + '-' + ticker
      if (byKey.has(listing)) members.add(listing)
    }
    for (const listing of fund.memberListings || []) if (byKey.has(listing)) members.add(listing)
    const search = fold([fund.name,fund.code,fund.provider,fund.venue,fund.theme,fund.benchmark,fund.detail].join(' '))
    products.set(key, {...fund,key,memberRefs,members,search})
  }
}

function showFund(key, trigger) {
  const p = products.get(key)
  if (!p) return false
  if (trigger) lastTrigger = trigger
  $('profile-kind').textContent = productType[p.type] + ' 档案'
  const related = [...products.values()].filter(item => item.key !== key && item.market === p.market && item.type !== p.type && (p.related?.includes(item.code) || item.related?.includes(p.code)))
  const lines = [[p.type === 'etf' ? '管理人' : '编制方', p.provider],['市场与场所',markets[p.market] + ' · ' + p.venue],['主题',p.theme],['跟踪基准',p.benchmark],['资料日期',p.asOf],['成分或持仓日期',p.holdingsAsOf]].filter(([,v]) => v)
  const basis = p.membershipBasis || (p.memberRefs.some(s => s.kind === 'fund') ? 'holdings' : 'index')
  const note = (basis === 'holdings' ? '按基金披露的实际持仓匹配。' : '按指数样本名单匹配。') + (p.sourceMemberCount ? '来源名单共 ' + count(p.sourceMemberCount) + ' 项。' : '')
  $('profile-content').innerHTML = '<h2 id="profile-title">' + esc(p.name) + '</h2><p class="ticker-line">' + esc(p.code) + ' · ' + productType[p.type] + '</p><dl class="profile-kv">' + lines.map(([k,v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl><p class="detail">' + esc(p.detail) + '</p><h3>官方资料</h3><p>' + external(p.url, p.type === 'etf' ? '基金产品及管理人资料' : '指数资料与编制说明') + '</p>' + (p.holdingsUrl && p.holdingsUrl !== p.url ? '<p>' + external(p.holdingsUrl, '持仓或指数成分来源') + '</p>' : '') + (p.members.size ? '<h3>图谱内关联证券</h3><p class="fund-note">' + note + '官方名单还可能含其他市场或未收录证券。</p><button class="product-link" data-members="' + esc(p.key) + '" type="button">查看 ' + count(p.members.size) + ' 条关联证券</button>' : '') + (related.length ? '<h3>' + (p.type === 'index' ? '关联 ETF' : '关联指数') + '</h3>' + related.map(fundButton).join('') : '')
  if (!$('profile').open) $('profile').showModal()
  $('profile').scrollTop = 0
  return true
}

function openFund(key, trigger) {
  if (!showFund(key, trigger)) return
  const url = new URL(location.href)
  url.searchParams.delete('listing')
  url.searchParams.set('instrument', key)
  history.pushState(null, '', url)
}

function renderFunds() {
  const terms = fold(fundState.q).split(/\s+/).filter(Boolean)
  const all = [...products.values()]
  const options = all.filter(p => (!fundState.market || p.market === fundState.market) && (!fundState.type || p.type === fundState.type) && terms.every(t => p.search.includes(t)))
  const leadCodes = {CN:['159819','930713','515980','931071'],HK:['03438','HKEXAI','03093','HSAIT'],US:['AIQ','IAIQ','BOTZ','ARTY']}
  const groups = Object.keys(markets).map(m => {
    const codes = leadCodes[m]
    const order = p => codes.includes(p.code) ? codes.indexOf(p.code) : codes.length
    return options.filter(p => p.market === m).sort((a,b) => order(a)-order(b))
  })
  const rows = []
  for (let i = 0; i < Math.max(0,...groups.map(g => g.length)); i++) {
    for (const g of groups) if (g[i]) rows.push(g[i])
  }
  const pages = Math.max(1, Math.ceil(rows.length / 12))
  fundState.page = Math.min(fundState.page, pages)
  const etfs = rows.filter(p => p.type === 'etf').length
  $('fund-status').textContent = '当前匹配 ' + count(etfs) + ' 只 ETF、' + count(rows.length - etfs) + ' 个指数 · 共收录 ' + count(all.length) + ' 项。'
  $('fund-list').innerHTML = rows.length ? rows.slice((fundState.page - 1)*12,fundState.page*12).map(p => '<button type="button" class="instrument" data-fund="' + esc(p.key) + '"><span class="code-line">' + esc(p.code) + ' · ' + productType[p.type] + '</span><strong>' + esc(p.name) + '</strong><small>' + markets[p.market] + ' · ' + esc(p.provider) + '</small></button>').join('') : '<p class="fund-note">未找到匹配产品，请调整市场、类型或搜索词。</p>'
  $('fund-pages').innerHTML = pages > 1 ? '<button type="button" data-fund-page="-1"' + (fundState.page === 1 ? ' disabled' : '') + '>上一页</button><span>' + fundState.page + ' / ' + pages + '</span><button type="button" data-fund-page="1"' + (fundState.page === pages ? ' disabled' : '') + '>下一页</button>' : ''
}
function bind() {
  document.addEventListener('click', e => {
    const button = e.target.closest('button')
    if (!button) return
    if (button.hasAttribute('data-fund')) return openFund(button.dataset.fund, $('profile').open ? null : button)
    if (button.hasAttribute('data-fund-page')) { fundState.page += Number(button.dataset.fundPage); renderFunds(); $('fund-status').scrollIntoView(); return }
    if (button.hasAttribute('data-members')) {
      const url = new URL(location.href)
      url.searchParams.delete('instrument')
      url.searchParams.delete('listing')
      history.replaceState(null, '', url)
      lastTrigger = null
      $('profile').close()
      return explore({members:button.dataset.members})
    }
    if (button.hasAttribute('data-map')) return setMap(button.dataset.map)
    if (button.hasAttribute('data-cell-market')) return explore({market:button.dataset.cellMarket,sector:button.dataset.cellSector})
    if (button.hasAttribute('data-topic')) return explore({q:button.dataset.topic})
    if (button.hasAttribute('data-go-market')) return explore({market:button.dataset.goMarket})
    if (button.hasAttribute('data-go-sector')) return explore({sector:button.dataset.goSector})
    if (button.hasAttribute('data-open')) return openProfile(button.dataset.open, $('profile').open ? null : button)
    if (button.hasAttribute('data-market')) { active.market = button.dataset.market; active.segment = ''; page = 1 }
    else if (button.id === 'clear' || button.hasAttribute('data-reset')) { reset() }
    else if (button.hasAttribute('data-page')) { page += Number(button.dataset.page); $('results').scrollIntoView({block:'start'}) }
    else return
    renderResults()
    updateUrl()
  })
  for (const id of ['sector', 'segment', 'evidence']) $(id).addEventListener('change', () => {
    active[id] = $(id).value
    if (id !== 'segment') active.segment = ''
    page = 1
    renderResults()
    updateUrl()
  })
  $('query').addEventListener('input', () => { active.q = $('query').value; page = 1; renderResults(); updateUrl() })
  for (const [id,field] of [['fund-query','q'],['fund-market','market'],['fund-type','type']]) {
    $(id).addEventListener(id === 'fund-query' ? 'input' : 'change', () => {fundState[field] = $(id).value; fundState.page = 1; renderFunds()})
  }
  $('download').addEventListener('click', exportCsv)
  $('close').addEventListener('click', () => $('profile').close())
  $('profile').addEventListener('click', e => { if (e.target === $('profile')) {const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('profile').close()} })
  $('profile').addEventListener('close', () => {
    const url = new URL(location.href)
    if (url.searchParams.has('listing') || url.searchParams.has('instrument')) { url.searchParams.delete('listing'); url.searchParams.delete('instrument'); history.replaceState(null, '', url) }
    if (lastTrigger?.isConnected) lastTrigger.focus({preventScroll:true})
    lastTrigger = null
  })
  window.addEventListener('popstate', syncLocation)
}
function prepare(data) {
  blocks = data.markets
  const lists = blocks.map(block => {
    const sourceMap = new Map(block.sources.map(s => [s.id,s]))
    return block.companies.map(r => {
      const refs = r.sources.map(id => sourceMap.get(id))
      const key = block.market + '-' + r.ticker
      const exact = new Set([r.name,r.ticker,...r.aliases || []].map(fold))
      if (block.market === 'HK') {
        const short = String(Number(r.ticker))
        for (const alias of [short, short + '.hk', short.padStart(4,'0') + '.hk', r.ticker + '.hk', 'hk' + r.ticker]) exact.add(alias)
      } else if (block.market === 'CN') {
        const suffix = {SSE:'sh',SZSE:'sz',BSE:'bj'}[r.venue]
        if (suffix) { exact.add(r.ticker + '.' + suffix); exact.add(suffix + r.ticker) }
      } else {
        exact.add(fold(r.venue + ':' + r.ticker))
        exact.add(fold(r.ticker + '.us'))
      }
      const row = {...r,market:block.market,key,refs,exact,direct:refs.some(s => s.kind === 'company')}
      const chinese = block.market === 'US' ? (r.aliases || []).filter(a => /[\u3400-\u9fff]/.test(a)).sort((a,b) => a.length - b.length)[0] : null
      row.displayName = chinese || r.name
      row.search = fold([...exact,sectors[r.sector][0],r.relationship || '',r.venue,...r.segments || [],r.detail].join(' '))
      byKey.set(key, row)
      return row
    }).sort((a,b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name,'zh-CN'))
  })
  // Interleave markets so that the initial directory represents all three.
  records = []
  const featured = ['US-NVDA','CN-688256','HK-00981','US-TSM','CN-300308','HK-09988','US-VRT','CN-002230','HK-09880','US-MSFT','CN-688041','HK-00020']
  for (const key of featured) if (byKey.has(key)) records.push(byKey.get(key))
  const fixed = new Set(records)
  for (let i = 0; i < Math.max(...lists.map(list => list.length)); i++) {
    for (const list of lists) if (list[i] && !fixed.has(list[i])) records.push(list[i])
  }
}
$('retry').addEventListener('click', () => location.reload())
try {
  const res = await fetch('./listings.json')
  if (!res.ok) throw Error('Cannot load listings: ' + res.status)
  const data = await res.json()
  prepare(data)
  prepareFunds(data.instruments || [])
  renderFunds()
  renderOverview()
  renderMatrix()
  renderSources()
  bind()
  syncLocation()
  const anchor = location.hash.slice(1)
  if (!$('profile').open && ['chain','directory','funds','method'].includes(anchor)) {
    requestAnimationFrame(() => $(anchor).scrollIntoView({behavior:'instant'}))
  }
} catch (e) { console.error(e); $('load-error').hidden = false; $('metrics').textContent = '数据未能载入'; $('results').textContent = '数据未能载入' }
