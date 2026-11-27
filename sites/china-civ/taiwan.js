import { esc, fmt, link, metricValue } from './ui.js'

export const taiwanLenses = [
  { id: 'twPopulation', name: '县市户籍人口', unit: '人', field: 'population' },
  { id: 'twPaddy', name: '县市稻谷产量', unit: '公吨', field: 'paddyTonnes' }
]

export function joinLocalities(registry, grain) {
  const crops = new Map(grain.counties.map((county) => [county.code, county]))
  return {
    ...registry,
    grainSource: grain.sources.crops,
    localities: registry.localities.map((place) => ({
      ...place,
      province: 'CN-TW',
      crop: crops.get(place.code),
      paddyTonnes: crops.get(place.code)?.paddyT ?? null
    }))
  }
}

const row = (name, number, unit) =>
  '<div class="kv"><span>' + esc(name) + '</span><b>' + metricValue(number, unit) + '</b></div>'
const source = (url, label) => '<p class="source">' + link(url, label) + '</p>'

export function localityCard(p, registry, gdp) {
  const crop = p.crop
  const reported = (value) => (Number.isFinite(value) ? fmt(value) + ' 公吨' : '原表列为「—」')
  return (
    '<section><h3>户籍登记 · 2024 年 12 月底</h3>' +
    row('登记人口', p.population, '人') +
    row('登记户数', p.households, '户') +
    row('男性', p.male, '人') +
    row('女性', p.female, '人') +
    row('0–14 岁', p.age0to14, '人') +
    row('15–64 岁', p.age15to64, '人') +
    row('65 岁及以上', p.age65plus, '人') +
    source(registry.source, '户政司原表') +
    '</section>' +
    '<section><h3>稻作 · 2024 全年</h3>' +
    '<div class="kv"><span>带壳稻谷</span><b>' +
    reported(p.paddyTonnes) +
    '</b></div>' +
    '<div class="kv"><span>折糙米</span><b>' +
    reported(crop?.brownRiceT) +
    '</b></div>' +
    row('稻米收获面积', crop?.riceAreaHa, '公顷') +
    row('带壳稻谷单产', crop?.riceYieldKgHa, '公斤/公顷') +
    source(registry.grainSource, '农业统计年报 · 稻米收获表') +
    '</section>' +
    '<p class="source">主计总处未编制县市 GDP。' +
    link(gdp.countyGdpSource, '统计说明') +
    '</p>' +
    '<button class="action" data-tw-explorer>比较 22 个县市 ↗</button>'
  )
}

export function regionalCard(t, focusMetric, extra, extraValue) {
  const gdp = t.gdp
  // Express the released GDP in trillions of NTD without rounding the source value.
  const gdpOriginal = (gdp.gdpTwdMillion / 1e6).toFixed(6)
  const population =
    row('年底户籍登记人口', t.population, '人') + source(t.populationSource, '户政司 · 12 月底')
  const economic =
    '<div class="kv"><span>现价 GDP</span><b>' +
    gdpOriginal +
    ' 万亿新台币</b></div>' +
    row('按年均汇率折算', gdp.gdp, '亿元人民币') +
    '<p class="source">1 元人民币兑 ' +
    gdp.twdPerCny.toFixed(4) +
    ' 新台币。' +
    link(gdp.source, gdp.revisionDate + ' 修订值') +
    ' · ' +
    link(gdp.exchangeSource, '汇率原表') +
    '</p>'
  const crops =
    row('谷类生产量（米按糙米计）', t.cerealsT, '公吨') +
    row('带壳稻谷产量', t.paddyT, '公吨') +
    '<p class="source">谷类含米、小麦、玉米、高粱等。带壳稻谷另列，不能与谷类相加。' +
    link(t.cerealsSource, '粮食供需年报') +
    ' · ' +
    link(t.paddySource, '稻作原表') +
    '</p>'
  const sections = { population, gdp: economic, grain: crops }
  const ordered = [
    ...new Set([...(sections[focusMetric] ? [focusMetric] : []), 'population', 'gdp', 'grain'])
  ]
  return (
    '<section><h3>台湾地区 · 2024 年</h3>' +
    (extra && !Object.hasOwn(sections, extra.id) ? row(extra.name, extraValue, extra.unit) : '') +
    ordered.map((key) => sections[key]).join('') +
    '<div class="cta"><button class="action" data-tw-explorer>县市数据表</button> ' +
    '<button class="action" data-lens="twPaddy">县市稻谷地图</button></div></section>'
  )
}
