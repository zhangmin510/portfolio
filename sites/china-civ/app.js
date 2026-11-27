import { createMap } from './map.js'
import { renderAlmanac } from './almanac.js'
import { renderExplorer } from './explorer.js'
import { esc, fmt, icon, coord, metricValue, json, link } from './ui.js'

const $ = (id) => document.getElementById(id)
const mainMap = $('map'),
  detail = $('detail'),
  tooltip = $('tooltip'),
  picker = $('picker'),
  dialog = $('dialog')
const defaultLayers = {
  cities: true,
  landmarks: true,
  rivers: true,
  boundaries: true,
  labels: true,
  grid: false
}
const layerLabels = {
  cities: '城市',
  landmarks: '世界遗产',
  rivers: '河流',
  boundaries: '区域界线',
  labels: '地名',
  grid: '格网'
}
const themes = [
  { id: 'terrain', name: '自然地形' },
  { id: 'elevation', name: '海拔高度' },
  { id: 'landcover', name: '地表与地貌' },
  { id: 'cities', name: '城镇分布' },
  { id: 'campus', name: '学府分布' },
  { id: 'aviation', name: '民航客运' }
]
const palettes = {
  人口: ['#d6dcab', '#aecb9e', '#81af91', '#568c83', '#386775'],
  农业: ['#e5dfaa', '#cbd386', '#a4b96e', '#759962', '#507858'],
  经济: ['#ece1ac', '#d8ca88', '#c1aa71', '#a88561', '#875e56'],
  创新: ['#d7dabb', '#b8c3bf', '#99abc4', '#7c8ea4', '#636c91']
}
const elevationLegend = [
  ['#81ac8c', '<200'],
  ['#adc187', '200–499'],
  ['#d4be80', '500–1499'],
  ['#b39e79', '1500–2999'],
  ['#a18a89', '3000–4999'],
  ['#e3e0d8', '≥5000 m']
]
const coverLegend = [
  ['#244965', '水域'],
  ['#9cab68', '平原'],
  ['#60845e', '森林'],
  ['#9ca96c', '草原'],
  ['#c7aa75', '裸地'],
  ['#72a48b', '湿地'],
  ['#9c9e6c', '高地'],
  ['#aca68c', '山地'],
  ['#d4d6c2', '冰雪'],
  ['#adb569', '耕地'],
  ['#ab986f', '城镇']
]
let map,
  places,
  stats,
  cityData,
  campus,
  aviation,
  geo,
  placeIndex,
  searchItems,
  metrics,
  countyPromise,
  shapesPromise
let lens = 'terrain',
  active = null,
  searchResults = [],
  matchIndex = -1,
  hashTimer = 0,
  toastTimer = 0,
  miniBase = null
const layers = { ...defaultLayers }
const readCounties = () =>
  (countyPromise ??= json('./data/counties.json').catch((err) => {
    countyPromise = null
    throw err
  }))
const readShapes = () =>
  (shapesPromise ??= json('./data/county-shapes.json')
    .then((d) => new Map(d.shapes.map((s) => [s.id, s.rings])))
    .catch((err) => {
      shapesPromise = null
      throw err
    }))
const visible = (el, show) => {
  el.hidden = !show
}
const kind = (p) =>
  p.kind === 'landmark'
    ? '世界遗产'
    : p.kind === 'province'
      ? '省级地区'
      : p.kind === 'county'
        ? '县级统计单元'
        : p.kind === 'campus'
          ? '学府城市'
          : p.kind === 'aviation'
            ? '民航城市'
            : '城市与聚落'
const kv = (label, value) => '<div class="kv"><span>' + esc(label) + '</span><b>' + value + '</b></div>'
const provinceOf = (p) => places.provinces.find((a) => a.id === p?.province)
const metric = (id) => metrics.get(id)
function toast(message) {
  $('toast').textContent = message
  visible($('toast'), true)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => visible($('toast'), false), 2600)
}
function setPicker(open) {
  visible(picker, open)
  $('more').setAttribute('aria-expanded', String(open))
  if (open) {
    closeSearch()
    visible(tooltip, false)
  }
  visible($('legend'), !open && lens !== 'terrain')
}
function drawPicker() {
  const group = (name, items) =>
    '<h3>' +
    esc(name) +
    '</h3><div class="chips">' +
    items
      .map(
        (t) =>
          '<button data-lens="' +
          esc(t.id) +
          '" class="' +
          (lens === t.id ? 'active' : '') +
          '">' +
          esc(t.name) +
          '</button>'
      )
      .join('') +
    '</div>'
  const groups = new Map()
  for (const m of stats.metrics) {
    if (!groups.has(m.group)) groups.set(m.group, [])
    groups.get(m.group).push(m)
  }
  picker.innerHTML =
    group('地图底图', themes) +
    Array.from(groups, ([name, items]) => group(name, items)).join('') +
    '<div class="checks">' +
    Object.entries(layerLabels)
      .map(
        ([key, label]) =>
          '<label><input type="checkbox" data-layer="' +
          key +
          '" ' +
          (layers[key] ? 'checked' : '') +
          '>' +
          label +
          '</label>'
      )
      .join('') +
    '</div>'
}
function swatches(items) {
  const block = document.createElement('div')
  block.className = 'swatches'
  for (const [color, label] of items) {
    const item = document.createElement('span'),
      dot = document.createElement('i')
    dot.style.backgroundColor = color
    item.append(dot, label)
    block.append(item)
  }
  return block
}
function updateLens(next, updateUrl = true) {
  if (!themes.some((t) => t.id === next) && !metrics.has(next)) next = 'terrain'
  lens = next
  let colors = {},
    legendItems = [],
    info = ''
  const m = metric(next)
  if (m) {
    const pairs = Object.entries(stats.regions).filter(([, r]) => Number.isFinite(r[next]))
    const values = pairs.map(([, r]) => r[next]).sort((a, b) => a - b)
    const stops = [0.2, 0.4, 0.6, 0.8].map((f) => values[Math.ceil(f * values.length) - 1])
    const pal = palettes[m.group] || palettes['人口']
    for (const [name, r] of pairs) colors[name] = pal[stops.filter((stop) => r[next] > stop).length]
    // Use an explicit missing-data color for polygons outside this table's scope.
    for (const p of places.provinces) colors[p.name] ??= '#83908b'
    legendItems = pal.map((color, i) => [color, i === 4 ? '>' + fmt(stops[3]) : '≤' + fmt(stops[i])])
    legendItems.push(['#83908b', '缺数'])
    info = m.name + ' · ' + m.unit + ' · ' + m.year + ' 年'
  } else if (next === 'elevation') {
    legendItems = elevationLegend
    info = '六角格海拔 · 米'
  } else if (next === 'landcover') {
    legendItems = coverLegend
    info = '地表与地貌 · MODIS / ETOPO1'
  } else if (next === 'cities') {
    info = '城镇分布 · GeoNames 地点'
    legendItems = [['#84a09a', '圆点表示聚落，点径随标注级别变化']]
  } else if (next === 'campus') {
    info = '教育部直属高校 · ' + campus.year + ' 年'
    legendItems = [['#876e96', '按学校登记城市聚合，点径随学校数变化']]
  } else if (next === 'aviation') {
    info = '民航客运 · 2024 年吞吐量前 50 座机场'
    legendItems = [['#538295', '按服务城市聚合，点径随旅客人次变化']]
  }
  map.setLens(next, colors)
  const legend = $('legend')
  legend.replaceChildren()
  if (info) {
    const title = document.createElement('h3')
    title.textContent = info
    legend.append(title, swatches(legendItems))
  }
  if (m) {
    const source = document.createElement('small')
    source.className = 'legend-source'
    const a = document.createElement('a')
    a.href = m.source
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = '指标原表 ↗'
    source.append('省级五分位 · ', a)
    legend.append(source)
  }
  document.querySelectorAll('.dock [data-lens]').forEach((b) => {
    const selected = b.dataset.lens === next
    b.classList.toggle('active', selected)
    b.setAttribute('aria-pressed', String(selected))
  })
  drawPicker()
  setPicker(false)
  if (active) drawDetail(active)
  if (updateUrl) queueHash()
}
function setMini(open) {
  visible($('mini-wrap'), open)
  visible($('mini-show'), !open)
}
function makeMini() {
  const mini = $('mini'),
    c = document.createElement('canvas')
  c.width = mini.width
  c.height = mini.height
  const g = c.getContext('2d')
  const path = (lines, close) => {
    g.beginPath()
    for (const ring of lines) {
      ring.forEach(([x, y], i) =>
        g[i ? 'lineTo' : 'moveTo'](((x - 70) / 67) * c.width, ((55 - y) / 40) * c.height)
      )
      if (close) g.closePath()
    }
  }
  g.fillStyle = '#244556'
  g.fillRect(0, 0, c.width, c.height)
  path(geo.land, true)
  g.fillStyle = '#546559'
  g.fill('evenodd')
  const colors = ['#a3aa79', '#929c73', '#a1a77a', '#9c9973', '#8e9b75']
  geo.areas.forEach((a, i) => {
    path(a.rings, true)
    g.fillStyle = colors[i % colors.length]
    g.fill('evenodd')
    g.strokeStyle = '#626e54'
    g.lineWidth = 0.8
    g.stroke()
  })
  path(geo.rivers, false)
  g.strokeStyle = '#658d94'
  g.lineWidth = 0.6
  g.stroke()
  miniBase = c
}
function renderMini() {
  if (!map || !miniBase) return
  const mini = $('mini'),
    g = mini.getContext('2d'),
    b = map.getBounds()
  g.drawImage(miniBase, 0, 0)
  g.strokeStyle = '#ffe8ab'
  g.lineWidth = 2
  const left = Math.max(2, ((b.west - 70) / 67) * mini.width),
    top = Math.max(2, ((55 - b.north) / 40) * mini.height)
  const right = Math.min(mini.width - 2, ((b.east - 70) / 67) * mini.width),
    bottom = Math.min(mini.height - 2, ((55 - b.south) / 40) * mini.height)
  g.strokeRect(left, top, right - left, bottom - top)
}
function viewChange(v) {
  $('coordinates').textContent = coord(v.lon, v.lat)
  $('view-title').textContent = v.zoom <= 1.05 ? '全国视图' : '区域视图'
  $('zoom-level').textContent = '×' + v.zoom.toFixed(2)
  renderMini()
  queueHash()
}
function hash() {
  const v = map.getView()
  const h = new URLSearchParams({ at: [v.lon.toFixed(3), v.lat.toFixed(3), v.zoom.toFixed(3)].join(',') })
  if (lens !== 'terrain') h.set('lens', lens)
  if (active?.place?.id) h.set('place', active.place.id)
  else if (active) h.set('tile', [active.lon.toFixed(3), active.lat.toFixed(3)].join(','))
  const changed = Object.keys(layers).filter((k) => layers[k] !== defaultLayers[k])
  if (changed.length) h.set('layers', changed.join(','))
  return '#' + h.toString().replaceAll('%2C', ',')
}
function syncHash() {
  clearTimeout(hashTimer)
  if (map) history.replaceState(null, '', hash())
}
function queueHash() {
  clearTimeout(hashTimer)
  hashTimer = setTimeout(syncHash, 180)
}
function closeDetail() {
  active = null
  visible(detail, false)
  map?.clearSelection()
  map?.highlightArea()
  queueHash()
}
function detailSelect(data) {
  visible(tooltip, false)
  setPicker(false)
  closeSearch()
  if (!data) {
    closeDetail()
    return
  }
  active = data
  map?.highlightArea()
  if (data.place?.kind === 'county') {
    const id = data.place.id
    readShapes()
      .then((shapes) => {
        if (active?.place?.id === id) map.highlightArea(shapes.get(id) || [])
      })
      .catch(() => toast('县界暂时未载入'))
  }
  drawDetail(data)
  queueHash()
}
function drawDetail(data) {
  const p = data.place
  const region =
    p?.kind === 'province' ? p : provinceOf(p) || places.provinces.find((r) => r.id === data.provinceCode)
  let title = p?.name || data.terrain,
    sub = p?.en || '',
    group = p ? kind(p) : '地形格',
    body = ''
  if (p?.kind === 'county') {
    sub = p.province + ' · ' + p.city
    body =
      '<section><h3>第七次人口普查 · 2020</h3>' +
      kv('常住人口', metricValue(p.population, '人')) +
      kv('2010 年人口', metricValue(p.population2010, '人')) +
      kv('十年变化', metricValue(p.growth, '%')) +
      kv('65 岁及以上', metricValue(p.age65, '%')) +
      kv('城镇人口占比', metricValue(p.urban, '%')) +
      kv('平均受教育年限', metricValue(p.schoolYears, '年')) +
      '</section>'
    body += '<p class="source">边界按研究面板协调。来源：Dong、Du、Liu 县域人口普查面板。</p>'
  } else if (p?.kind === 'campus') {
    body =
      '<p>' +
      esc(campus.scope) +
      '</p><section><h3>' +
      campus.year +
      ' 年 · ' +
      p.items.length +
      ' 所直属高校</h3>' +
      p.items
        .map(
          (school) =>
            '<div class="kv">' + link(school.url, school.name) + link(school.ror, 'ROR') + '</div>'
        )
        .join('') +
      '</section>' +
      link(campus.source, '教育部名录')
  } else if (p?.kind === 'aviation') {
    body =
      '<p>' +
      esc(aviation.scope) +
      '</p><section><h3>2024 年 · 入选机场合计</h3>' +
      kv('旅客吞吐量', metricValue(p.count, '人次')) +
      kv('货邮吞吐量', metricValue(p.record.cargoTonnes, '吨')) +
      '</section><section><h3>本市入选机场</h3>' +
      p.record.airports.map((a) => kv(a.name, metricValue(a.passengers, '人次'))).join('') +
      '</section>' +
      link(aviation.source, '民航局统计公报')
  } else if (p?.kind === 'landmark') {
    body =
      '<p>' +
      esc(p.description) +
      '</p><section>' +
      kv('遗产类型', esc(p.type)) +
      kv('列入年份', esc(p.year)) +
      kv('代表位置', esc(p.component)) +
      kv('遗产组成部分', fmt(p.components)) +
      '</section>' +
      link(p.link, 'UNESCO 遗产档案')
  } else if (p && p.kind !== 'province' && p.kind !== 'tile') {
    const d = cityData.cities[p.id],
      weather = stats.climate[p.name]
    body = '<p>' + esc(p.description || '') + '</p>'
    if (p.population)
      body +=
        '<section>' +
        kv('GeoNames 收录人口', metricValue(p.population, '人')) +
        '<p class="source">各地统计年份与范围不一。' +
        link('https://www.geonames.org/' + p.id.slice(3) + '/', '地名记录') +
        '</p></section>'
    if (d) {
      body +=
        '<section><h3>城市特色 · 依 2024 年统计判定</h3>' +
        d.districts
          .map(
            (t) =>
              '<details><summary class="badge">' +
              esc(t.name) +
              '</summary><p class="source">' +
              esc(t.reason) +
              '</p></details>'
          )
          .join('') +
        '</section>'
      body +=
        '<section><h3>2024 城市档案 · 含市辖县</h3>' +
        cityData.metrics.map((m) => kv(m.name, metricValue(d[m.id], m.unit))).join('') +
        link(cityData.source, '年鉴表 25-2') +
        '</section>'
    }
    if (weather && p.rank <= 2)
      body +=
        '<section><h3>城市气候 · 2024</h3>' +
        kv('年平均气温', metricValue(weather.temperature, '°C')) +
        kv('年降水量', metricValue(weather.precipitation, 'mm')) +
        link(stats.climateSources.temperature, '气温原表') +
        ' · ' +
        link(stats.climateSources.precipitation, '降水原表') +
        '</section>'
  } else if (p?.kind === 'province') {
    body = '<p>' + esc(p.description) + '</p>'
  }
  body +=
    '<section><h3>地形格 · 约 25 km</h3>' +
    kv('地表', esc(data.terrain)) +
    kv('地形格近似海拔', metricValue(data.elevation, 'm')) +
    kv('坐标', esc(coord(data.lon, data.lat))) +
    '</section>'
  if (region && p?.kind !== 'county') {
    const row = stats.regions[region.name] || {},
      fields = [...new Set([...(metric(lens) ? [lens] : []), 'population', 'gdp', 'grain'])]
    body +=
      '<section><h3>' +
      esc(region.name) +
      ' · 省级统计</h3>' +
      fields
        .map((id) => {
          const m = metric(id)
          return kv(m.name + ' · ' + m.year, metricValue(row[id], m.unit))
        })
        .join('')
    body +=
      '<button class="action" data-detail-report="' +
      (metric(lens) ? lens : 'gdp') +
      '">查看地区比较 ↗</button></section>'
  }
  detail.innerHTML =
    '<button class="close" aria-label="关闭详情" data-close-detail>×</button><div class="eyebrow">' +
    esc(group) +
    (region ? ' / ' + esc(region.name) : '') +
    '</div><h2>' +
    esc(title) +
    '</h2><div class="en">' +
    esc(sub) +
    '</div>' +
    body
  detail.scrollTop = 0
  visible(detail, true)
}
function hover(data) {
  if (!data || !picker.hidden || dialog.open || matchMedia('(hover:none)').matches) {
    visible(tooltip, false)
    return
  }
  let info = data.terrain
  const m = metric(lens),
    r = stats.regions[data.province]
  if (m && Number.isFinite(r?.[lens])) info = fmt(r[lens]) + ' ' + m.unit + ' · 省级'
  if (data.place?.kind === 'campus') info = fmt(data.place.count) + ' 所直属高校'
  if (data.place?.kind === 'aviation') info = fmt(data.place.count) + ' 旅客人次'
  tooltip.innerHTML =
    '<b>' + esc(data.place?.name || data.province || data.terrain) + '</b><small>' + esc(info) + '</small>'
  visible(tooltip, true)
  tooltip.style.left = Math.max(3, Math.min(innerWidth - tooltip.offsetWidth - 7, data.x + 12)) + 'px'
  tooltip.style.top = Math.max(3, Math.min(innerHeight - tooltip.offsetHeight - 8, data.y + 15)) + 'px'
}
function pick(p, fly = true) {
  if (dialog.open) dialog.close()
  closeSearch()
  setPicker(false)
  if (fly && (p.kind === 'campus' || p.kind === 'aviation') && lens !== p.kind) updateLens(p.kind)
  else if (fly && (lens === 'campus' || lens === 'aviation') && p.kind !== lens) updateLens('terrain')
  if (fly) map.flyTo(p.lon, p.lat, p.kind === 'province' ? 2.7 : p.kind === 'county' ? 8 : 5)
  map.selectPlace(p)
}
function resetView() {
  closeDetail()
  map.reset()
  closeSearch()
  setPicker(false)
}
function closeSearch() {
  visible($('matches'), false)
  $('search').setAttribute('aria-expanded', 'false')
  $('search').removeAttribute('aria-activedescendant')
  matchIndex = -1
}
const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s'’·-]/g, '')
function search() {
  const q = normalize($('search').value.trim())
  if (!q) {
    closeSearch()
    return
  }
  const found = searchItems
    .map((it) => {
      const score = it.tokens.reduce(
        (v, t) => Math.min(v, t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : 9),
        9
      )
      return { p: it.p, score }
    })
    .filter((it) => it.score < 9)
  found.sort((a, b) => a.score - b.score || (a.p.rank ?? 2) - (b.p.rank ?? 2))
  searchResults = found.slice(0, 12).map((f) => f.p)
  matchIndex = searchResults.length ? 0 : -1
  paintMatches()
}
function paintMatches() {
  $('matches').innerHTML = searchResults.length
    ? searchResults
        .map(
          (p, i) =>
            '<button class="match" id="match-' +
            i +
            '" role="option" aria-selected="' +
            (i === matchIndex) +
            '" data-pick="' +
            esc(p.id) +
            '"><i>' +
            icon(p.kind === 'landmark' ? 'wonder' : p.kind === 'province' ? 'map' : 'pin') +
            '</i>' +
            esc(p.name) +
            '<small>' +
            esc(provinceOf(p)?.name || '') +
            ' · ' +
            kind(p) +
            '</small></button>'
        )
        .join('')
    : '<div class="match">没有找到匹配的地点</div>'
  visible($('matches'), true)
  $('search').setAttribute('aria-expanded', 'true')
  if (matchIndex >= 0) $('search').setAttribute('aria-activedescendant', 'match-' + matchIndex)
}
function openDialog() {
  closeSearch()
  setPicker(false)
  visible(tooltip, false)
  if (!dialog.open) dialog.showModal()
  $('dialog-body').replaceChildren()
  dialog.scrollTop = 0
}
function atlas(section = 'guide', id = 'gdp') {
  openDialog()
  renderAlmanac($('dialog-body'), {
    stats,
    places,
    cityData,
    section,
    metric: id,
    onPick: pick,
    onLens: (id) => {
      dialog.close()
      updateLens(id)
    }
  })
}
function explorer() {
  openDialog()
  renderExplorer($('dialog-body'), { stats, places, onPick: pick, initialLevel: 'province' }).catch((e) => {
    $('dialog-body').textContent = e.message
  })
}
function help() {
  openDialog()
  $('dialog-body').innerHTML =
    '<div class="article"><h1>操作指南</h1><p>拖动地图平移，滚轮或双指缩放。点击城市旗标、遗产徽章或六角格，查看该位置的真实记录。城市特色标签可展开查看判定依据。</p><h2>键盘与触控</h2><ul><li><kbd>/</kbd> 或 <kbd>Ctrl / ⌘ K</kbd> 搜索；用上下键选中结果，回车定位。</li><li>方向键平移，<kbd>+</kbd>／<kbd>−</kbd> 缩放，<kbd>0</kbd> 返回全国。</li><li><kbd>L</kbd> 切换透镜菜单，<kbd>?</kbd> 查看指南，<kbd>Esc</kbd> 关闭面板。</li></ul><h2>如何读图</h2><p>旗标数字采用 GeoNames 收录人口，统计年份与范围因城市而异。金色圆章标记 UNESCO 世界遗产。省级透镜按有值地区的五分位着色；探索器可以比较省级指标和县级人口普查数据。</p></div>'
}
function share() {
  syncHash()
  openDialog()
  $('dialog-body').innerHTML =
    '<div class="article"><h1>分享这张舆图</h1><p>链接保存当前地图位置、缩放、透镜、图层和所选地点。</p><input class="share-url" id="share-url" aria-label="当前视图链接" readonly><div class="cta"><button class="action" id="copy-view">复制视图链接</button><button class="action" id="save-image">下载地图 PNG</button></div></div>'
  $('share-url').value = location.href
  $('copy-view').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('share-url').value)
      $('copy-view').textContent = '已复制'
    } catch {
      $('share-url').select()
      $('copy-view').textContent = '请复制已选链接'
    }
  }
  $('save-image').onclick = () => {
    const c = document.createElement('canvas'),
      w = mainMap.width,
      h = mainMap.height,
      bar = Math.max(42, Math.round(w * 0.032))
    c.width = w
    c.height = h + 2 * bar
    const ctx = c.getContext('2d')
    ctx.drawImage(mainMap, 0, bar)
    ctx.fillStyle = '#1a3032'
    ctx.fillRect(0, 0, w, bar)
    ctx.fillRect(0, bar + h, w, bar)
    ctx.fillStyle = '#e2cc99'
    ctx.font = 'bold ' + Math.round(bar * 0.48) + 'px serif'
    ctx.fillText(
      '中华舆图  /  ' + (metric(lens)?.name || themes.find((t) => t.id === lens).name),
      bar * 0.4,
      bar * 0.67
    )
    ctx.font = Math.round(bar * 0.3) + 'px sans-serif'
    ctx.fillText(
      'zhangmin.name/china-civ/  ·  Natural Earth · NOAA · NASA · GeoNames · UNESCO · 国家统计局',
      bar * 0.4,
      bar + h + bar * 0.62,
      w - bar * 0.8
    )
    c.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = '中华舆图-' + lens + '.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    })
  }
}
async function restore(initial) {
  closeDetail()
  const params = new URLSearchParams(initial.slice(1))
  const nums = (params.get('at') || '').split(',').map(Number)
  if (nums.length === 3 && nums.every(Number.isFinite)) map.flyTo(...nums, false)
  for (const k of Object.keys(layers)) layers[k] = defaultLayers[k]
  for (const k of (params.get('layers') || '').split(','))
    if (Object.hasOwn(defaultLayers, k)) layers[k] = !defaultLayers[k]
  map.setLayers(layers)
  updateLens(params.get('lens') || 'terrain', false)
  const id = params.get('place')
  let p = placeIndex.get(id)
  if (!p && id && /^[\d;]+$/.test(id)) {
    const record = (await readCounties()).items.find((r) => r.id === id)
    if (record) p = { ...record, kind: 'county' }
  }
  if (p) pick(p, false)
  else if (params.has('tile')) {
    const t = params.get('tile').split(',').map(Number)
    if (t.length === 2 && t.every(Number.isFinite)) map.selectTile(...t)
  }
}
function bind() {
  document.querySelectorAll('[data-icon]').forEach((node) => (node.innerHTML = icon(node.dataset.icon)))
  $('more').onclick = () => setPicker(picker.hidden)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (b?.dataset.lens) updateLens(b.dataset.lens)
    else if (b?.dataset.report) atlas('report', b.dataset.report)
    else if (b?.dataset.pick) pick(placeIndex.get(b.dataset.pick))
    else if (b?.dataset.detailReport) atlas('atlas', b.dataset.detailReport)
    else if (b?.hasAttribute('data-close-detail')) closeDetail()
    if (!e.target.closest('#search-box') && !$('matches').hidden) closeSearch()
    if (!e.target.closest('.dock-wrap') && !picker.hidden) setPicker(false)
  })
  picker.onchange = (e) => {
    const key = e.target.dataset.layer
    if (key) {
      layers[key] = e.target.checked
      map.setLayers(layers)
      queueHash()
    }
  }
  $('search').oninput = search
  $('search').onfocus = () => {
    if ($('search').value) search()
  }
  $('search').onkeydown = (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && searchResults.length) {
      e.preventDefault()
      matchIndex =
        (matchIndex + (e.key === 'ArrowDown' ? 1 : -1) + searchResults.length) % searchResults.length
      paintMatches()
      $('match-' + matchIndex).scrollIntoView({ block: 'nearest' })
    }
    if (e.key === 'Enter' && matchIndex >= 0 && !$('matches').hidden) {
      e.preventDefault()
      pick(searchResults[matchIndex])
      $('search').blur()
    }
    if (e.key === 'Escape') {
      closeSearch()
      $('search').blur()
      e.stopPropagation()
    }
  }
  $('plus').onclick = () => map.setZoom(1.5)
  $('minus').onclick = () => map.setZoom(1 / 1.5)
  $('reset').onclick = $('home-view').onclick = resetView
  $('mini-hide').onclick = () => setMini(false)
  $('mini-show').onclick = () => setMini(true)
  $('mini').onclick = (e) => {
    const r = $('mini').getBoundingClientRect()
    map.flyTo(
      70 + (67 * (e.clientX - r.left)) / r.width,
      55 - (40 * (e.clientY - r.top)) / r.height,
      Math.max(2, map.getView().zoom)
    )
  }
  $('mini').onkeydown = (e) => {
    if (e.key === 'Enter') resetView()
  }
  $('share').onclick = share
  $('open-atlas').onclick = () => atlas()
  $('explore').onclick = explorer
  $('help').onclick = help
  $('close-dialog').onclick = () => dialog.close()
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        dialog.close()
    }
  }
  document.addEventListener('keydown', (e) => {
    if (dialog.open || e.altKey) return
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      $('search').focus()
      return
    }
    if (e.metaKey || e.ctrlKey || e.target.closest('input,textarea,select')) return
    const pans = { ArrowUp: [0, -70], ArrowDown: [0, 70], ArrowLeft: [-70, 0], ArrowRight: [70, 0] }
    if (pans[e.key]) {
      e.preventDefault()
      map.panBy(...pans[e.key])
      return
    }
    if (e.key === '/') {
      e.preventDefault()
      $('search').focus()
    } else if (e.key === '?') help()
    else if (e.key === '+' || e.key === '=') map.setZoom(1.45)
    else if (e.key === '-') map.setZoom(1 / 1.45)
    else if (e.key === '0') resetView()
    else if (e.key.toLowerCase() === 'l') setPicker(picker.hidden)
    else if (e.key === 'Escape') {
      if (!picker.hidden) setPicker(false)
      else closeDetail()
    }
  })
}
async function init() {
  const initial = location.hash
  ;[places, stats, cityData, geo, campus, aviation] = await Promise.all(
    [
      'places.json',
      'statistics.json',
      'city-indicators.json',
      'data/geography.json',
      'campus.json',
      'air-traffic.json'
    ].map(json)
  )
  metrics = new Map(stats.metrics.map((m) => [m.id, m]))
  const cities = new Map(places.cities.map((p) => [p.id, p]))
  const schoolsByCity = new Map()
  for (const school of campus.items) {
    if (!schoolsByCity.has(school.cityId)) schoolsByCity.set(school.cityId, [])
    schoolsByCity.get(school.cityId).push(school)
  }
  const point = (id, kind, count, extra) => {
    const city = cities.get(id)
    return {
      id: kind + '-' + id,
      kind,
      name: city.name,
      en: city.en,
      lon: city.lon,
      lat: city.lat,
      province: city.province,
      rank: 2,
      count,
      ...extra
    }
  }
  const schoolPoints = Array.from(schoolsByCity, ([id, items]) =>
    point(id, 'campus', items.length, {
      items,
      aliases: items.flatMap((s) => [s.name, s.en]).filter(Boolean)
    })
  )
  const airportPoints = Object.entries(aviation.cities).map(([id, record]) =>
    point(id, 'aviation', record.passengers, {
      record,
      aliases: record.airports.map((a) => a.name.split('/').pop() + '机场')
    })
  )
  const mapPoints = [...places.cities, ...places.landmarks, ...schoolPoints, ...airportPoints]
  const all = [...mapPoints, ...places.provinces.map((p) => ({ ...p, kind: 'province' }))]
  placeIndex = new Map(all.map((p) => [p.id, p]))
  searchItems = all.map((p) => ({
    p,
    tokens: [p.name, p.en, ...(p.aliases || [])].filter(Boolean).map(normalize)
  }))
  makeMini()
  setMini(innerWidth > 700)
  map = await createMap(mainMap, {
    places: mapPoints,
    provinces: places.provinces,
    onSelect: detailSelect,
    onHover: hover,
    onView: viewChange
  })
  await restore(initial)
  bind()
  window.addEventListener('hashchange', () => restore(location.hash).catch((e) => toast(e.message)))
  viewChange(map.getView())
  visible($('loading'), false)
}
init().catch((e) => {
  console.error(e)
  $('loading').textContent = '舆图加载失败。' + e.message + '，请刷新重试。'
})
