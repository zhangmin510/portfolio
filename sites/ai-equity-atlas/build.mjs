import { readFile } from 'node:fs/promises'

const markets = ['CN', 'HK', 'US']
const sectors = new Set(['chips', 'compute', 'infra', 'models', 'software', 'robotics', 'devices', 'services', 'mixed'])
const kinds = new Set(['company', 'index', 'fund', 'theme', 'exchange', 'other'])
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
const validLink = value => {
  try { return ['https:', 'http:'].includes(new URL(value).protocol) }
  catch { return false }
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const requireValue = (condition, message) => { if (!condition) throw new Error(message) }

function validate(block, market) {
  const fail = (condition, message) => requireValue(condition, market + ': ' + message)
  fail(block.market === market && validDate(block.asOf), 'invalid market or date')
  const sources = new Set()
  for (const s of block.sources) {
    fail(nonempty(s.id) && !sources.has(s.id) && nonempty(s.title), 'invalid source ' + s.id)
    fail(validLink(s.url) && validDate(s.asOf) && kinds.has(s.kind), 'invalid source metadata ' + s.id)
    sources.add(s.id)
  }
  const tickers = new Set()
  for (const row of block.companies) {
    fail([row.name,row.detail,row.venue,row.ticker].every(nonempty) && sectors.has(row.sector), 'invalid listing ' + row.ticker)
    fail(!tickers.has(row.ticker), 'duplicate ticker ' + row.ticker)
    fail(market !== 'HK' || /^\d{5}$/.test(row.ticker), 'invalid HK code ' + row.ticker)
    fail(market !== 'CN' || /^\d{6}$/.test(row.ticker), 'invalid A-share code ' + row.ticker)
    fail(Array.isArray(row.sources) && row.sources.length > 0 && row.sources.every(id => sources.has(id)), 'unresolved evidence for ' + row.ticker)
    for (const url of [row.profileUrl, row.evidenceUrl]) if (url) fail(validLink(url), 'invalid record link ' + row.ticker)
    for (const field of ['aliases', 'segments']) if (row[field]) fail(Array.isArray(row[field]) && row[field].every(nonempty), 'invalid ' + field + ' for ' + row.ticker)
    tickers.add(row.ticker)
  }
  fail(tickers.size > 0, 'empty snapshot')
}

const marketNames = {CN:'A 股', HK:'港股', US:'美股'}

function addCrossListings(blocks, pairs) {
  const markets = new Map(blocks.map(b => [b.market, b]))
  const rows = new Map(blocks.flatMap(b => b.companies.map(r => [b.market + '-' + r.ticker, r])))
  function supplement(target, identity, from, original, identityUrl) {
    const sourceIds = []
    for (const id of original.sources) {
      const source = from.sources.find(s => s.id === id)
      if (source.kind === 'exchange') continue
      const linkedId = from.market + '/' + id
      if (!target.sources.some(s => s.id === linkedId)) {
        target.sources.push({...source, id:linkedId, title:source.title + '（' + marketNames[from.market] + '发行人记录）'})
      }
      sourceIds.push(linkedId)
    }
    const venueSource = {HKEX:'hk-main', SSE:'cn-list-sh', SZSE:'cn-list-sz', BSE:'cn-list-bj', Nasdaq:'nasdaq-listed'}[identity.venue] || 'other-listed'
    sourceIds.push(venueSource)
    const row = {
      ...identity, sector:original.sector, segments:original.segments,
      detail:'同一发行人的' + marketNames[from.market] + '记录（' + original.ticker + '）提供业务依据。' + original.detail,
      sources:sourceIds, aliases:[...new Set([original.name,...original.aliases || []])].filter(s => s !== identity.name),
      evidenceUrl:original.evidenceUrl, evidenceLabel:original.evidenceLabel,
      profileUrl:identityUrl, linkedFrom:from.market + '-' + original.ticker,
    }
    target.companies.push(row)
    rows.set(target.market + '-' + row.ticker, row)
    return row
  }
  for (const pair of pairs) {
    const hk = markets.get('HK'), other = markets.get(pair.market)
    let h = rows.get('HK-' + pair.hkTicker), r = rows.get(pair.market + '-' + pair.ticker)
    if (!h && !r) continue
    const identityUrl = pair.market === 'CN'
      ? 'https://datacenter-web.eastmoney.com/api/data/v1/get?' + new URLSearchParams({reportName:'RPT_F10_BASIC_ORGINFO',columns:'SECUCODE,ORG_NAME,ORG_NAME_EN,STR_CODEH,STR_NAMEH',filter:'(SECUCODE="' + pair.codeWithSuffix + '")',pageSize:'1'})
      : 'https://www.sec.gov/edgar/browse/?CIK=' + pair.cik
    if (!h) h = supplement(hk, {ticker:pair.hkTicker,name:pair.hkName,venue:'HKEX'}, other, r, identityUrl)
    if (!r) r = supplement(other, {ticker:pair.ticker,name:pair.name,venue:pair.venue}, hk, h, identityUrl)
    r.hkTicker = pair.hkTicker
    h[pair.market === 'CN' ? 'cnTicker' : 'usTicker'] = pair.ticker
    if (pair.cik) r.companyId = 'sec:' + pair.cik
  }
}

// Resolve verified alternative codes into groups. Counts remain per security.
function linkListings(blocks) {
  const rows = new Map(blocks.flatMap(b => b.companies.map(r => [b.market + '-' + r.ticker, r])))
  const parents = new Map()
  function root(key) {
    let head = key
    while (parents.has(head)) head = parents.get(head)
    return head
  }
  function join(a, b) {
    if (!rows.has(a) || !rows.has(b)) return
    const x = root(a), y = root(b)
    if (x !== y) parents.set(y, x)
  }
  const issuerIds = new Map()
  for (const [key, row] of rows) {
    if (row.companyId) {
      if (issuerIds.has(row.companyId)) join(issuerIds.get(row.companyId), key)
      else issuerIds.set(row.companyId, key)
    }
    for (const [field, market] of [['hkTicker','HK'], ['usTicker','US'], ['cnTicker','CN']]) {
      if (row[field]) join(key, market + '-' + row[field])
    }
  }
  for (const [key] of parents) {
    const group = root(key)
    rows.get(key).group = group
    rows.get(group).group = group
  }
}

function shareIssuerDisclosures(blocks) {
  const groups = new Map()
  for (const block of blocks) {
    const sourceMap = new Map(block.sources.map(s => [s.id, s]))
    for (const r of block.companies) {
      if (!r.group) continue
      const current = groups.get(r.group) || []
      current.push({block, r, docs:r.sources.map(id => sourceMap.get(id)).filter(s => s.kind === 'company')})
      groups.set(r.group, current)
    }
  }
  for (const rows of groups.values()) for (const entry of rows) {
    if (entry.docs.length) continue
    for (const peer of rows) for (const doc of peer.docs) {
      const id = 'issuer/' + peer.block.market + '/' + doc.id
      const existing = entry.block.sources.find(s => s.url === doc.url && s.kind === 'company')
      if (!existing) entry.block.sources.push({...doc,id,title:doc.title + '（同一发行人披露）'})
      const linked = existing?.id || id
      if (!entry.r.sources.includes(linked)) entry.r.sources.push(linked)
    }
  }
}

async function readInstruments(block) {
  const path = new URL('./data/' + block.market.toLowerCase() + '-instruments.json', import.meta.url)
  const products = JSON.parse(await readFile(path, 'utf8'))
  const keys = new Set()
  const sources = new Map(block.sources.map(s => [s.id, s]))
  for (const p of products) {
    const key = p.type + '-' + p.code
    const fail = (condition, msg) => requireValue(condition, block.market + ' ' + key + ': ' + msg)
    fail(p.market === block.market && ['etf','index'].includes(p.type), 'invalid product type or market')
    fail(!keys.has(key) && [p.code,p.name,p.provider,p.venue,p.theme,p.detail].every(nonempty), 'invalid identity')
    fail(validLink(p.url) && validDate(p.asOf) && (!p.holdingsUrl || validLink(p.holdingsUrl)), 'invalid source')
    fail((p.memberSources || []).every(id => ['index','fund'].includes(sources.get(id)?.kind)), 'unresolved membership source')
    if (p.memberListings) fail(p.memberListings.every(id => /^(CN-\d{6}|HK-\d{5}|US-[A-Z0-9.-]+)$/.test(id)), 'invalid cross-market member')
    if (p.memberTickers) {
      fail(Array.isArray(p.memberTickers) && p.memberTickers.every(nonempty), 'invalid member codes')
      fail(['index','holdings'].includes(p.membershipBasis) && validLink(p.holdingsUrl || p.url), 'missing membership basis')
    }
    keys.add(key)
  }
  for (const p of products) {
    for (const id of p.related || []) {
      requireValue(keys.has((p.type === 'etf' ? 'index-' : 'etf-') + id), block.market + ' ' + p.code + ': unresolved related code ' + id)
    }
  }
  return products
}

export async function equitySnapshot() {
  const blocks = await Promise.all(markets.map(async market => {
    const path = new URL('./data/' + market.toLowerCase() + '.json', import.meta.url)
    const block = JSON.parse(await readFile(path, 'utf8'))
    validate(block, market)
    return block
  }))
  const pairs = JSON.parse(await readFile(new URL('./data/cross-listings.json', import.meta.url), 'utf8'))
  addCrossListings(blocks, pairs)
  linkListings(blocks)
  shareIssuerDisclosures(blocks)
  for (const block of blocks) validate(block, block.market)
  const instruments = (await Promise.all(blocks.map(readInstruments))).flat()
  return JSON.stringify({ markets: blocks, instruments }) + '\n'
}
