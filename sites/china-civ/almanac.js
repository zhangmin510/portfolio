import { esc, fmt, icon, link } from './ui.js'

const COMMUNIQUE = 'https://www.stats.gov.cn/sj/zxfb/202502/t20250228_1958817.html'
const LOCAL_DOCS = './'
const reports = {
  population: {
    title: '年末人口',
    value: '14.0828 亿人',
    text: '2024 年末城镇常住人口为 9.4350 亿人，占全国人口的 67.0%。人口范围为大陆 31 个省区市和现役军人。'
  },
  gdp: {
    title: '国内生产总值',
    value: '134.9084 万亿元',
    text: '2024 年公报初步核算值。按不变价格计算，比上年增长 5.0%。第三产业占当年 GDP 的 56.7%。'
  },
  grain: {
    title: '全年粮食产量',
    value: '7.0650 亿吨',
    text: '2024 年全国粮食总产量为 70,650 万吨，比上年增长 1.6%。粮食包括谷物、豆类和薯类。'
  }
}
const topics = [
  ['人口', 'population'],
  ['经济', 'gdp'],
  ['农业', 'grain'],
  ['就业', 'jobs'],
  ['民生', 'income'],
  ['创新', 'inventions'],
  ['能源', 'electricity'],
  ['交通', 'freight'],
  ['教育', 'universities'],
  ['自然资源', 'forestCover'],
  ['城市', 'city'],
  ['气候', 'weather'],
  ['遗产', 'heritage']
]
const pages = { guide: '操作指南', atlas: '专题图鉴', report: '全国报告', sources: '数据来源' }

function menu(items, action, active) {
  return (
    '<div class="tabs">' +
    items
      .map(
        ([value, label]) =>
          '<button type="button" data-book-' +
          action +
          '="' +
          esc(value) +
          '" aria-pressed="' +
          (value === active) +
          '" class="' +
          (value === active ? 'active' : '') +
          '">' +
          esc(label) +
          '</button>'
      )
      .join('') +
    '</div>'
  )
}

function options(metrics, selected, label) {
  return (
    '<div class="filters"><label>' +
    esc(label) +
    '<select data-book-choice>' +
    metrics
      .map(
        (m) =>
          '<option value="' +
          esc(m.id) +
          '"' +
          (m.id === selected ? ' selected' : '') +
          '>' +
          esc(m.name) +
          '</option>'
      )
      .join('') +
    '</select></label></div>'
  )
}

function ranking(rows, unit) {
  const ordered = rows.filter((r) => Number.isFinite(r.value)).sort((a, b) => b.value - a.value)
  if (!ordered.length) return '<p>该指标尚无可用记录。</p>'
  const limit = Math.max(...ordered.map((r) => Math.abs(r.value)), 1)
  return ordered
    .slice(0, 8)
    .map(
      ({ place, value }) =>
        '<button type="button" class="rank" data-book-place="' +
        esc(place.id) +
        '"><span>' +
        esc(place.name) +
        '</span><i aria-hidden="true" data-book-width="' +
        ((Math.abs(value) / limit) * 45).toFixed(2) +
        '"></i><b>' +
        fmt(value) +
        ' ' +
        esc(unit) +
        '</b></button>'
    )
    .join('')
}

function sourceList(stats, places) {
  const yearbook = 'https://www.stats.gov.cn/sj/ndsj/2025/indexch.htm'
  const county = 'https://github.com/leiii/census/tree/0ba0f1efae092f4aa6569ef38e53b3bb4d2f0087'
  return (
    '<h1>数据从哪里来</h1><h2>人口、产业与气象</h2><ul>' +
    '<li>国家统计局。全国三项总量取 2024 年统计公报公布值，省级比较取《中国统计年鉴2025》与粮食产量公告。各指标原表列在专题图鉴中。 ' +
    link(COMMUNIQUE, '全国公报') +
    ' · ' +
    link(yearbook, '统计年鉴') +
    ' · ' +
    link(LOCAL_DOCS + 'source-statistics/README.md', '指标定义') +
    '</li>' +
    '<li>城市产业、教育、医疗等 12 项指标取年鉴表 25-2，覆盖 36 座城市，包含市辖县。34 座城市的年均气温与年降水量来自 2024 年观测。 ' +
    link('https://www.stats.gov.cn/sj/ndsj/2025/html/C25-02.jpg', '城市原表') +
    ' · ' +
    link(stats.climateSources.temperature, '气温原表') +
    ' · ' +
    link(stats.climateSources.precipitation, '降水原表') +
    '</li>' +
    '<li>县域采用董磊、杜瑞、刘瑜等整理的普查资料。2,774 个统计单元有 2020 年人口，2,666 个可比较 2010 与 2020 年；边界调整地区可能合并为一个单元。数据署名 Lei Dong，MIT 许可。 ' +
    link(county, '研究数据') +
    ' · ' +
    link(LOCAL_DOCS + 'COUNTIES.md', '县域口径与许可') +
    '</li></ul>' +
    '<h2>城镇与世界遗产</h2><ul><li>© GeoNames，CC BY 4.0。使用 ' +
    esc(places.snapshot) +
    ' 快照的地名与 WGS84 坐标，选取和简化中文名，补充搜索别名。城镇人口的年份与统计范围因记录而异。 ' +
    link('https://www.geonames.org/', 'GeoNames') +
    ' · ' +
    link('https://creativecommons.org/licenses/by/4.0/', '许可') +
    '</li>' +
    '<li>遗产图层改编自 UNESCO DataHub 的 World Heritage List。每项选用一处组成地坐标，并补充中文短名与说明。该衍生图层按 CC BY-SA 4.0 共享。 ' +
    link('https://data.unesco.org/explore/dataset/whc001/', 'UNESCO DataHub') +
    ' · ' +
    link('https://creativecommons.org/licenses/by-sa/4.0/', '许可') +
    ' · ' +
    link(LOCAL_DOCS + 'source-places/README.md', '摘录与编辑说明') +
    '</li></ul>' +
    '<h2>地形与制图</h2><ul><li>Natural Earth 公有领域数据提供概化海岸、河湖与行政区域。 ' +
    link('https://www.naturalearthdata.com/about/terms-of-use/', '数据与许可') +
    '</li>' +
    '<li>海拔与阴影使用 Amante 与 Eakins 的 NOAA NCEI ETOPO1（2009）。植被与土地利用取自 Friedl 与 Sulla-Menashe 的 NASA MODIS MCD12Q1 v6.1（2024 年分类）。地图按六角格取样，地形读数仅供地理浏览。 ' +
    link('https://doi.org/10.7289/V5C8276M', 'ETOPO1') +
    ' · ' +
    link('https://doi.org/10.5067/MODIS/MCD12Q1.061', 'MODIS') +
    ' · ' +
    link(LOCAL_DOCS + 'TERRAIN.md', '地形处理方法') +
    '</li></ul>' +
    '<h2>高校与民航</h2><p>学府图层依据教育部直属高校名录，按登记城市合并。民航图层采用民航局 2024 年境内机场旅客吞吐量前 50 名，按匹配到的服务城市汇总。位置均在城市中心。 ' +
    link('./CAMPUS.md', '高校名录与来源') +
    ' · ' +
    link('https://www.caac.gov.cn/XXGK/XXGK/TJSJ/202503/t20250314_226932.html', '民航局原表') +
    '</p>' +
    '<h2>原作</h2><p>六角格地图、资源栏与数据透镜的设计参考 Andrej Karpathy 的 USACiv。 ' +
    link('https://karpathy.ai/usaciv/', '访问 USACiv') +
    '</p>'
  )
}

export function renderAlmanac(
  container,
  { stats, places, cityData, onLens, onPick, section = 'guide', metric = 'population' }
) {
  let page = Object.hasOwn(pages, section) ? section : 'atlas'
  let reportId = Object.hasOwn(reports, metric) ? metric : 'population'
  let provinceMetric =
    stats.metrics.find((m) => m.id === metric) || stats.metrics.find((m) => m.id === 'population')
  let topic = provinceMetric.group
  let cityMetric = 'gdp'
  let weatherMetric = 'precipitation'
  let heritageType = '全部'
  const provinces = places.provinces.map((p) => ({ ...p, kind: 'province' }))
  const cities = places.cities.map((p) => ({ ...p, kind: 'city' }))
  const cityById = new Map(cities.map((c) => [c.id, c]))
  const allPlaces = new Map([...provinces, ...cities, ...places.landmarks].map((p) => [p.id, p]))

  function lensButton(id) {
    return (
      '<button class="action" data-book-lens="' + esc(id) + '">' + icon('layers') + '在地图上着色</button>'
    )
  }

  function provinceComparison(m) {
    const rows = provinces.map((place) => ({ place, value: stats.regions[place.name]?.[m.id] }))
    const count = rows.filter((r) => Number.isFinite(r.value)).length
    return (
      '<h2>' +
      m.year +
      ' 年 · ' +
      esc(m.name) +
      '</h2><p>' +
      esc(m.description) +
      ' 下列为 ' +
      count +
      ' 个有值地区中的前八位，点击地名可定位。</p>' +
      ranking(rows, m.unit) +
      '<p>' +
      link(m.source, '原始数据表') +
      '</p><div class="cta">' +
      lensButton(m.id) +
      '</div>'
    )
  }

  function cityComparison() {
    if (!cityData?.metrics?.length) return '<p>城市统计尚未载入。</p>'
    const m = cityData.metrics.find((x) => x.id === cityMetric) || cityData.metrics[0]
    const rows = Object.entries(cityData.cities)
      .map(([id, record]) => ({ place: cityById.get(id), value: record[m.id] }))
      .filter((r) => r.place)
    return (
      options(cityData.metrics, m.id, '城市指标') +
      '<h2>' +
      esc(m.name) +
      ' · ' +
      cityData.year +
      ' 年</h2><p>' +
      esc(m.description) +
      ' 比较年鉴收录的 ' +
      rows.length +
      ' 座城市，范围包括市辖县。</p>' +
      ranking(rows, m.unit) +
      '<p>点开城市可查看产业、外贸、学院等游戏标签，以及对应的指标与门槛。 ' +
      link(m.source, '城市原表') +
      '</p>'
    )
  }

  function weatherComparison() {
    const metrics = [
      { id: 'precipitation', name: '全年降水量', unit: '毫米' },
      { id: 'temperature', name: '年平均气温', unit: '℃' }
    ]
    const m = metrics.find((x) => x.id === weatherMetric)
    const rows = Object.entries(stats.climate)
      .map(([name, value]) => ({ place: cities.find((c) => c.name === name), value: value[m.id] }))
      .filter((r) => r.place)
    return (
      options(metrics, m.id, '城市气象') +
      '<h2>2024 年 · ' +
      m.name +
      '</h2><p>比较年鉴中 ' +
      rows.length +
      ' 个城市的年度观测值。点击城市可在地图上查看它位于海岸、平原还是高原。</p>' +
      ranking(rows, m.unit) +
      '<p>' +
      link(stats.climateSources[m.id], '原始观测表') +
      '</p>'
    )
  }

  function heritageIndex() {
    const types = ['全部', '文化遗产', '自然遗产', '文化与自然双重遗产']
    const hits = places.landmarks
      .filter((p) => heritageType === '全部' || p.type === heritageType)
      .sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, 'zh-CN'))
    return (
      options(
        types.map((v) => ({ id: v, name: v })),
        heritageType,
        '遗产类别'
      ) +
      '<h2>' +
      hits.length +
      ' 项 · 按首次列入年份排列</h2><p>多地组成的遗产在图中选取一处组成地。例如长城标在八达岭，点入档案可查其余组成地。</p>' +
      '<div class="table-wrap"><table><thead><tr><th>遗产</th><th>标注地区</th><th>列入年</th></tr></thead><tbody>' +
      hits
        .map(
          (p) =>
            '<tr><td><button data-book-place="' +
            esc(p.id) +
            '">' +
            esc(p.name) +
            '</button></td><td>' +
            esc(allPlaces.get(p.province)?.name) +
            '</td><td>' +
            p.year +
            '</td></tr>'
        )
        .join('') +
      '</tbody></table></div><p>' +
      link('https://whc.unesco.org/en/statesparties/cn/', '世界遗产名录') +
      '</p>'
    )
  }

  function atlas() {
    const buttons = menu(
      topics.map(([g]) => [g, g]),
      'topic',
      topic
    )
    let detail
    if (topic === '遗产') detail = heritageIndex()
    else if (topic === '气候') detail = weatherComparison()
    else if (topic === '城市') detail = cityComparison()
    else
      detail =
        options(
          stats.metrics.filter((m) => m.group === topic),
          provinceMetric.id,
          '省级指标'
        ) + provinceComparison(provinceMetric)
    return '<h1>专题图鉴</h1>' + buttons + detail
  }

  function report() {
    const r = reports[reportId]
    const m = stats.metrics.find((x) => x.id === reportId)
    return (
      '<h1>2024 年全国报告</h1>' +
      menu(
        Object.entries(reports).map(([k, r]) => [k, r.title]),
        'report',
        reportId
      ) +
      '<h2>' +
      esc(r.title) +
      '</h2><h1>' +
      esc(r.value) +
      '</h1><p>' +
      esc(r.text) +
      ' ' +
      link(COMMUNIQUE, '当年统计公报') +
      '</p>' +
      provinceComparison(m)
    )
  }

  function guide() {
    const routes = [
      ['whc-1414', '看天山的高差'],
      ['gn-1809858', '查看广州的产业'],
      ['whc-438', '定位八达岭长城']
    ]
    return (
      '<h1>读懂这张六角地图</h1><p>从一个地点开始，或选一项统计，观察颜色如何随地区改变。</p><div class="cta">' +
      routes
        .filter(([id]) => allPlaces.has(id))
        .map(
          ([id, text]) =>
            '<button class="action" data-book-place="' + id + '">' + icon('pin') + esc(text) + '</button>'
        )
        .join('') +
      '</div>' +
      '<h2>读文明产出</h2><p>顶部的市民、金币和麦穗分别对应年末人口、国内生产总值和粮食产量。点击图标可打开当年的全国报告；点击城市中的“学院”或“工业区”可查看它获得标签所依据的统计门槛。</p><h2>在地图上移动</h2><ul><li>拖动地图平移，滚轮、双指或 ＋／− 改变比例。小地图可直接定位。</li><li>点击城镇、遗产或六角格查看档案。按 / 搜索中文名或城市拼音。</li></ul>' +
      '<h2>比较地区</h2><p>底部的“透镜”可切换统计指标，图例标明单位和颜色范围。“探索器”可以筛选、比较县域的普查数据；有边界调整的县区按可比单元展示。</p>' +
      '<div class="cta"><button class="action" data-book-page="atlas">' +
      icon('chart') +
      '打开专题图鉴</button>' +
      lensButton('population') +
      '</div>' +
      '<h2>识别地图要素</h2><p>山岭与林木呈现地貌和土地覆盖，聚落标注来自地名记录。遗产图标可打开 UNESCO 档案；城市的产业标签由 2024 年全市统计值计算。</p>'
    )
  }

  function draw() {
    container.innerHTML =
      '<article class="article">' +
      menu(Object.entries(pages), 'page', page) +
      (page === 'sources'
        ? sourceList(stats, places)
        : page === 'report'
          ? report()
          : page === 'atlas'
            ? atlas()
            : guide()) +
      '</article>'
    for (const bar of container.querySelectorAll('[data-book-width]'))
      bar.style.width = bar.dataset.bookWidth + '%'
    for (const btn of container.querySelectorAll('button'))
      btn.addEventListener('click', () => {
        const d = btn.dataset
        if (d.bookPlace) {
          onPick(allPlaces.get(d.bookPlace))
          return
        }
        if (d.bookLens) {
          onLens(d.bookLens)
          return
        }
        if (d.bookPage) page = d.bookPage
        if (d.bookReport) reportId = d.bookReport
        if (d.bookTopic) {
          topic = d.bookTopic
          const base = topics.find((t) => t[0] === topic)?.[1]
          provinceMetric = stats.metrics.find((m) => m.id === base) || provinceMetric
        }
        draw()
        const active = container.querySelector(
          '[data-book-' + (d.bookTopic ? 'topic' : d.bookReport ? 'report' : 'page') + '].active'
        )
        active?.focus({ preventScroll: true })
      })
    const selector = container.querySelector('select')
    selector?.addEventListener('change', () => {
      if (topic === '城市') cityMetric = selector.value
      else if (topic === '气候') weatherMetric = selector.value
      else if (topic === '遗产') heritageType = selector.value
      else provinceMetric = stats.metrics.find((x) => x.id === selector.value) || provinceMetric
      draw()
      container.querySelector('select')?.focus({ preventScroll: true })
    })
  }
  draw()
}
