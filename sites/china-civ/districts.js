import { esc, fmt, link, metricValue } from './ui.js'

export function prepareTerritory({ region, districts, metrics }) {
  const key = region.code.slice(-2).toLowerCase()
  const lenses = metrics.map((m) => ({
    ...m,
    key,
    field: m.id,
    id: key + m.id[0].toUpperCase() + m.id.slice(1)
  }))
  const lens = lenses.find((m) => m.field === 'population')
  return {
    ...region,
    key,
    lens,
    lenses,
    metrics,
    districts: districts.map((p) => ({
      ...p,
      id: key + '-' + p.code,
      province: region.code,
      kind: 'district',
      aliases: [p.officialName, ...(p.aliases || []), region.name + p.name, p.code].filter(Boolean)
    }))
  }
}

const row = (label, value, unit) =>
  '<div class="kv"><span>' + esc(label) + '</span><b>' + metricValue(value, unit) + '</b></div>'
const note = (text, url, label) => '<p class="source">' + esc(text) + ' ' + link(url, label) + '</p>'
const explorerButton = (r) =>
  '<button class="action" data-explorer="' +
  esc(r.key) +
  '">比较' +
  r.districts.length +
  '个分区</button>'

export function territoryCard(r, local, comparableGdp) {
  return (
    '<section><h3>' +
    esc(r.name + '特别行政区') +
    ' · ' +
    r.year +
    ' 年</h3>' +
    row('年底人口', r.population, '人') +
    note(r.populationNote, r.populationSource, '人口原表') +
    row('全年现价 GDP', r.gdpMillion / 100, '亿' + r.currency) +
    note(r.gdpNote, r.gdpSource, '本地生产总值原表') +
    row('按年均汇率折算', comparableGdp, '亿元人民币') +
    note(
      '1 元人民币兑 ' + r.currencyPerCny + ' ' + r.currency + '。' + (r.exchangeNote || ''),
      r.exchangeSource,
      '汇率原表'
    ) +
    '<div class="cta"><button class="action" data-lens="' +
    r.lens.id +
    '">' +
    esc(r.name) +
    '分区人口地图</button> ' +
    explorerButton(r) +
    '</div></section>' +
    (local
      ? '<section><h3>' +
        esc(local.name) +
        ' · ' +
        r.districtYear +
        ' 年</h3>' +
        row(r.metrics[0].name, local.population, '人') +
        '<button class="action" data-pick="' +
        esc(local.id) +
        '">查看分区档案 ↗</button></section>'
      : '')
  )
}

export function districtCard(p, r) {
  return (
    '<section><h3>' +
    esc(r.name + r.districtLabel) +
    ' · ' +
    r.districtYear +
    ' 年</h3>' +
    r.metrics
      .map(
        (m) =>
          row(m.name, p[m.id], m.unit) +
          (m.note || m.source
            ? '<p class="source">' +
              esc(m.note || '') +
              ' ' +
              (m.source ? link(m.source, '指标原表') : '') +
              '</p>'
            : '')
      )
      .join('') +
    note(r.districtNote, r.districtSource, '分区统计原表') +
    note(r.boundaryNote, r.boundarySource, '地图边界来源') +
    '<p class="source">' +
    esc(r.districtGdpNote) +
    '</p><div class="cta">' +
    explorerButton(r) +
    ' <button class="action" data-pick="' +
    esc(r.code) +
    '">全' +
    (r.key === 'hk' ? '港' : '澳') +
    '人口与 GDP</button></div></section>'
  )
}
