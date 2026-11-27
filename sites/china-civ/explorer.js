import { esc, fmt, json, link } from './ui.js'

const countyMetrics = [
  ['population', '常住人口', '人'],
  ['population2010', '2010 年常住人口', '人'],
  ['growth', '十年人口变化', '%'],
  ['children', '0–14 岁人口占比', '%'],
  ['age65', '65 岁及以上人口占比', '%'],
  ['urban', '城镇人口占比', '%'],
  ['householdSize', '平均家庭户规模', '人/户'],
  ['schoolYears', '平均受教育年限', '年']
].map(([id, name, unit]) => ({ id, name, unit }))

const pageSize = 15
const collator = new Intl.Collator('zh-CN', { numeric: true })
let cachedCounties

function counties() {
  cachedCounties ??= json('./data/counties.json').catch((error) => {
    cachedCounties = undefined
    throw error
  })
  return cachedCounties
}

function metricName(metric) {
  return metric.name + '（' + metric.unit + '）'
}

function tickText(value) {
  if (Math.abs(value) >= 1e8) return fmt(value / 1e8) + '亿'
  if (Math.abs(value) >= 1e4) return fmt(value / 1e4) + '万'
  return fmt(value)
}

function axisRange(values) {
  const min = Math.min(...values),
    max = Math.max(...values)
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1
    return [min - pad, max + pad]
  }
  const step = (max - min) / 3
  const power = 10 ** Math.floor(Math.log10(step))
  const spacing = [1, 2, 2.5, 5, 10].find((n) => n * power >= step) * power
  return [Math.floor(min / spacing) * spacing, Math.ceil(max / spacing) * spacing]
}

function chart(canvas, rows, xMetric, yMetric) {
  const width = canvas.clientWidth,
    height = canvas.clientHeight
  if (width < 10 || height < 10) return []
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)
  ctx.font = '11px system-ui, sans-serif'
  const left = width < 400 ? 42 : 57,
    right = width - 26,
    top = 26,
    bottom = height - 31
  ctx.fillStyle = '#dac99e'
  ctx.fillText(metricName(yMetric), 7, 15)
  ctx.textAlign = 'right'
  ctx.fillText(metricName(xMetric), width - 9, height - 4)
  const valid = rows.filter(
    (r) => Number.isFinite(r.values[xMetric.id]) && Number.isFinite(r.values[yMetric.id])
  )
  if (!valid.length) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#b6c7be'
    ctx.fillText('当前筛选没有两项指标俱全的记录', width / 2, height / 2)
    return []
  }
  const [x0, x1] = axisRange(valid.map((row) => row.values[xMetric.id]))
  const [y0, y1] = axisRange(valid.map((row) => row.values[yMetric.id]))
  ctx.font = '10px system-ui, sans-serif'
  for (let t = 0; t <= 4; t++) {
    const x = left + ((right - left) * t) / 4,
      y = bottom - ((bottom - top) * t) / 4
    ctx.strokeStyle = '#344d49'
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
    ctx.fillStyle = '#bfccbd'
    ctx.textAlign = 'right'
    ctx.fillText(tickText(y0 + ((y1 - y0) * t) / 4), left - 5, y + 3)
    ctx.textAlign = 'center'
    ctx.fillText(tickText(x0 + ((x1 - x0) * t) / 4), x, bottom + 12)
  }
  ctx.fillStyle = valid.length > 100 ? 'rgba(170,206,157,.55)' : '#d6c68d'
  const radius = valid.length > 100 ? 2.5 : 4
  return valid.map((row) => {
    const x = left + ((row.values[xMetric.id] - x0) / (x1 - x0)) * (right - left)
    const y = bottom - ((row.values[yMetric.id] - y0) / (y1 - y0)) * (bottom - top)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    return { x, y, row }
  })
}

export async function renderExplorer(container, { stats, places, onPick, initialLevel = 'province' }) {
  const root = document.createElement('section')
  root.className = 'explorer'
  root.innerHTML =
    '<h1>数据探索器</h1><div class="tabs" aria-label="统计层级"><button data-level="province">省级地区</button><button data-level="county">县域人口</button></div><div data-content></div>'
  container.replaceChildren(root)
  const content = root.querySelector('[data-content]')
  let level, metrics, records, xId, yId, sortId, descending, page, visible, sorted, points, observer
  let loadTicket = 0

  function selectMetric(id) {
    return metrics.find((metric) => metric.id === id)
  }

  function choose(row) {
    if (row) onPick({ ...row.place, kind: level === 'county' ? 'county' : 'province' })
  }

  function draw() {
    const canvas = content.querySelector('canvas')
    if (!canvas || !canvas.isConnected) {
      observer?.disconnect()
      return
    }
    points = chart(canvas, visible, selectMetric(xId), selectMetric(yId))
    content.querySelector('[data-count]').textContent =
      '符合筛选 ' + fmt(visible.length) + ' 个 · 已绘 ' + fmt(points.length) + ' 点'
    content.querySelector('[data-hover]').textContent = '指向图点查看数值，选中图点或表中地名可定位。'
  }

  function renderTable() {
    const cols = [...new Set([sortId, xId, yId])].map(selectMetric)
    const nPages = Math.max(1, Math.ceil(sorted.length / pageSize))
    page = Math.min(page, nPages - 1)
    const start = page * pageSize
    const table = content.querySelector('table')
    table.innerHTML =
      '<thead><tr><th scope="col">地区</th>' +
      cols
        .map(
          (m) =>
            '<th scope="col"' +
            (m.id === sortId ? ' aria-sort="' + (descending ? 'descending' : 'ascending') + '"' : '') +
            '><button data-order="' +
            esc(m.id) +
            '">' +
            esc(m.name) +
            '<br>' +
            esc(m.unit) +
            (m.id === sortId ? (descending ? ' ↓' : ' ↑') : '') +
            '</button></th>'
        )
        .join('') +
      '</tr></thead><tbody>' +
      sorted
        .slice(start, start + pageSize)
        .map(
          (row, i) =>
            '<tr><td><button type="button" data-index="' +
            (start + i) +
            '" title="在地图上定位">' +
            esc(row.place.name) +
            '</button>' +
            (level === 'county' ? '<br><small>' + esc(row.location) + '</small>' : '') +
            '</td>' +
            cols.map((m) => '<td>' + fmt(row.values[m.id]) + '</td>').join('') +
            '</tr>'
        )
        .join('') +
      '</tbody>'
    content.querySelector('[data-page]').textContent = sorted.length
      ? '第 ' + (page + 1) + ' / ' + nPages + ' 页 · 共 ' + fmt(sorted.length) + ' 条'
      : '没有匹配的地区'
    content.querySelector('[data-prev]').disabled = page === 0
    content.querySelector('[data-next]').disabled = page + 1 >= nPages
    content.querySelector('.table-wrap').scrollTop = 0
  }

  function filter() {
    const query = content.querySelector('input[type=search]').value.trim().toLowerCase()
    const province = content.querySelector('[data-province]')?.value
    visible = records.filter(
      (row) => (!province || row.place.province === province) && row.search.includes(query)
    )
    sortTable()
    draw()
  }

  function sortTable() {
    sorted = [...visible].sort((a, b) => {
      const av = a.values[sortId],
        bv = b.values[sortId]
      const af = Number.isFinite(av),
        bf = Number.isFinite(bv)
      if (af !== bf) return af ? -1 : 1
      if (af && av !== bv) return descending ? bv - av : av - bv
      return collator.compare(a.place.name, b.place.name)
    })
    page = 0
    content.querySelector('[data-sort]').value = sortId
    content.querySelector('[data-direction]').textContent = descending ? '降序 ↓' : '升序 ↑'
    renderTable()
  }

  function nearest(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top
    let chosen,
      dist = 121
    for (const p of points) {
      const d = (x - p.x) ** 2 + (y - p.y) ** 2
      if (d < dist) {
        dist = d
        chosen = p.row
      }
    }
    return chosen
  }

  function controls(coverage, source) {
    const select = (attr, label, id) =>
      '<label>' +
      label +
      '<select ' +
      attr +
      '>' +
      metrics
        .map(
          (m) =>
            '<option value="' +
            esc(m.id) +
            '"' +
            (m.id === id ? ' selected' : '') +
            '>' +
            esc(m.name) +
            '</option>'
        )
        .join('') +
      '</select></label>'
    const regions = [...new Set(records.map((r) => r.place.province))].sort(collator.compare)
    content.innerHTML =
      '<p class="muted">' +
      esc(coverage) +
      '</p><div class="filters">' +
      '<label>查找地区<input type="search" placeholder="地名或代码" autocomplete="off"></label>' +
      (level === 'county'
        ? '<label>省级地区<select data-province><option value="">全部地区</option>' +
          regions.map((s) => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('') +
          '</select></label>'
        : '') +
      select('data-x', '横轴', xId) +
      select('data-y', '纵轴', yId) +
      '</div>' +
      '<div class="plot-box"><canvas aria-label="当前筛选地区的双指标散点图，数据详见下表。"></canvas></div>' +
      '<div><b data-count></b><br><small data-hover></small></div><h2>地区数据</h2>' +
      '<div class="filters">' +
      select('data-sort', '排序指标', sortId) +
      '<button class="action" data-direction aria-label="切换排序方向"></button></div>' +
      '<div class="table-wrap"><table aria-label="地区统计值"></table></div><div class="pages"><button class="action" data-prev>上一页</button>' +
      '<span data-page aria-live="polite"></span><button class="action" data-next>下一页</button></div>' +
      '<small>— 表示缺值，排在表尾。散点只绘制两项指标均有值的地区。' +
      source +
      '</small>'
    content.querySelector('input').oninput = filter
    content.querySelector('[data-province]')?.addEventListener('change', filter)
    for (const axis of ['x', 'y']) {
      content.querySelector('[data-' + axis + ']').onchange = (e) => {
        if (axis === 'x') xId = e.target.value
        else yId = e.target.value
        draw()
        renderTable()
      }
    }
    content.querySelector('[data-sort]').onchange = (e) => {
      sortId = e.target.value
      sortTable()
    }
    content.querySelector('[data-direction]').onclick = () => {
      descending = !descending
      sortTable()
    }
    content.querySelector('[data-prev]').onclick = () => {
      page--
      renderTable()
    }
    content.querySelector('[data-next]').onclick = () => {
      page++
      renderTable()
    }
    content.querySelector('table').onclick = (e) => {
      const target = e.target.closest('button')
      if (!target) return
      if (target.hasAttribute('data-index')) choose(sorted[Number(target.dataset.index)])
      else if (target.dataset.order) {
        descending = sortId === target.dataset.order ? !descending : true
        sortId = target.dataset.order
        sortTable()
      }
    }
    const canvas = content.querySelector('canvas')
    canvas.onpointermove = (event) => {
      const row = nearest(event),
        note = content.querySelector('[data-hover]')
      if (!row) {
        note.textContent = '指向图点查看数值，选中图点或表中地名可定位。'
        return
      }
      note.textContent =
        row.place.name +
        ' · ' +
        [selectMetric(xId), selectMetric(yId)]
          .map((m) => m.name + ' ' + fmt(row.values[m.id]) + ' ' + m.unit)
          .join(' · ')
    }
    canvas.onpointerleave = () => {
      content.querySelector('[data-hover]').textContent = '指向图点查看数值，选中图点或表中地名可定位。'
    }
    canvas.onclick = (event) => choose(nearest(event))
    filter()
    observer = new ResizeObserver(draw)
    observer.observe(canvas)
  }

  async function switchLevel(next) {
    const ticket = ++loadTicket
    observer?.disconnect()
    level = next
    for (const b of root.querySelectorAll('[data-level]')) {
      const active = b.dataset.level === level
      b.classList.toggle('active', active)
      b.setAttribute('aria-pressed', String(active))
    }
    let source, coverage
    if (level === 'county') {
      content.innerHTML = '<p role="status">正在读取县域人口数据…</p>'
      try {
        const data = await counties()
        if (ticket !== loadTicket || root.parentElement !== container) return
        metrics = countyMetrics
        records = data.items.map((place) => {
          const location = [...new Set([place.province, place.city])].join(' · ')
          return {
            place,
            values: place,
            location,
            search: [place.name, place.id, place.city, place.province].join(' ').toLowerCase()
          }
        })
        source = link(data.sourceUrl, '普查数据整理与口径')
        coverage = data.coverage
      } catch (error) {
        if (ticket === loadTicket) {
          content.innerHTML =
            '<p role="alert">' + esc(error.message) + '</p><button class="action">重新载入</button>'
          content.querySelector('button').onclick = () => switchLevel('county')
        }
        return
      }
      xId = 'population'
      yId = 'growth'
      sortId = xId
    } else {
      metrics = stats.metrics
      records = places.provinces.map((place) => ({
        place,
        values: stats.regions[place.name] || {},
        search: [place.name, place.en, place.id, place.capital].join(' ').toLowerCase()
      }))
      xId = 'population'
      yId = 'gdp'
      sortId = yId
      coverage =
        stats.year +
        ' 年分省指标，森林覆盖率为 2014—2018 年清查值。可浏览 ' +
        records.length +
        ' 个省级地区，港澳台按来源覆盖显示。'
      source = link('https://www.stats.gov.cn/sj/ndsj/2025/indexch.htm', '中国统计年鉴 2025')
    }
    descending = true
    controls(coverage, source)
  }
  for (const b of root.querySelectorAll('[data-level]')) b.onclick = () => switchLevel(b.dataset.level)
  await switchLevel(initialLevel === 'county' ? 'county' : 'province')
}
