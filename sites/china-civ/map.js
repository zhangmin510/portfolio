// A spherical Lambert conformal conic keeps the national view close to the proportions
// of a printed Chinese atlas. World coordinates and hex geometry are in kilometres.
const rad = Math.PI / 180
const halfPi = Math.PI / 2
const cone =
  Math.log(Math.cos(25 * rad) / Math.cos(47 * rad)) /
  Math.log(Math.tan((halfPi + 47 * rad) / 2) / Math.tan((halfPi + 25 * rad) / 2))
const factor = (6371 * Math.cos(25 * rad) * Math.tan((halfPi + 25 * rad) / 2) ** cone) / cone
const rho0 = factor / Math.tan((halfPi + 36 * rad) / 2) ** cone
const W = 25
const R = W / Math.sqrt(3)
const DY = R * 1.5
const LEFT = -3820
const TOP = -2640
const RIGHT = 3820
const BOTTOM = 2430
const COLS = Math.ceil((RIGHT - LEFT) / W) + 1
const ROWS = Math.ceil((BOTTOM - TOP) / DY) + 1
const colors = [
  '#244965',
  '#9cab68',
  '#60845e',
  '#9ca96c',
  '#c7aa75',
  '#72a48b',
  '#9c9e6c',
  '#aca68c',
  '#d4d6c2',
  '#adb569',
  '#ab986f'
]
const terrainNames = [
  '海域',
  '平原',
  '森林',
  '草原',
  '荒漠与裸地',
  '湿地',
  '高地',
  '山地',
  '冰雪',
  '耕地',
  '城镇'
]
const elevationColors = ['#81ac8c', '#adc187', '#d4be80', '#b39e79', '#a18a89', '#e3e0d8']
const oceanColors = ['#467d88', '#3a6c7d', '#315b70', '#2d5268', '#294b63', '#25455d']
const labelFont = '"Songti SC","STSong","Noto Serif CJK SC",serif'
const anchors = [
  ['塔里木盆地', 83.5, 39.3],
  ['青 藏 高 原', 87.2, 32.1],
  ['阿拉善高原', 102.8, 40.3],
  ['内蒙古高原', 113.3, 43.8],
  ['四川盆地', 106.0, 30.0],
  ['东北平原', 124.0, 45.4],
  ['东 海', 125.8, 28.7],
  ['黄 海', 124, 34.7],
  ['南 海', 114.2, 17.7]
]
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value))
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function project(lon, lat) {
  const rho = factor / Math.tan((halfPi + lat * rad) / 2) ** cone
  const theta = (lon - 104) * rad * cone
  return [rho * Math.sin(theta), rho * Math.cos(theta) - rho0]
}
function unproject(x, y) {
  const rho = Math.hypot(x, y + rho0)
  return [
    104 + Math.atan2(x, y + rho0) / (cone * rad),
    (2 * Math.atan((factor / rho) ** (1 / cone)) - halfPi) / rad
  ]
}
function noise(col, row) {
  let bits = Math.imul(col + 417, 374761393) + Math.imul(row + 691, 668265263)
  bits = Math.imul(bits ^ (bits >>> 13), 1274126177)
  return (bits ^ (bits >>> 16)) >>> 0
}
function pathFromLines(lines, close = false) {
  const path = new Path2D()
  for (const line of lines || []) {
    for (let i = 0; i < line.length; i++) {
      const point = project(line[i][0], line[i][1])
      if (!i) path.moveTo(...point)
      else path.lineTo(...point)
    }
    if (close) path.closePath()
  }
  return path
}
function mix(a, b, t) {
  let result = '#'
  for (let i = 1; i <= 5; i += 2) {
    const x = parseInt(a.slice(i, i + 2), 16)
    const y = parseInt(b.slice(i, i + 2), 16)
    result += Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0')
  }
  return result
}
function canvas2d(width, height, read = false) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c.getContext('2d', { willReadFrequently: read })
}
function hexPath() {
  const p = new Path2D()
  for (let i = 0; i < 6; i++) {
    const angle = (60 * i - 90) * rad
    const x = Math.cos(angle),
      y = Math.sin(angle)
    if (!i) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  p.closePath()
  return p
}
const hexagon = hexPath()
function poly(ctx, points, fill, stroke) {
  ctx.beginPath()
  for (let i = 0; i < points.length; i += 2) {
    if (!i) ctx.moveTo(points[i], points[i + 1])
    else ctx.lineTo(points[i], points[i + 1])
  }
  if (fill) {
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
}

// The terrain stamps are original small-scale pen-and-ink drawings, with their
// facets lit consistently from the northwest, like the elevation shading.
function mountain(ctx, x, y, s, snowy) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  poly(ctx, [-0.64, 0.28, -0.17, -0.48, -0.03, -0.57, 0.59, 0.27, 0.31, 0.38, -0.38, 0.39], '#828576')
  poly(
    ctx,
    [-0.64, 0.28, -0.17, -0.48, -0.03, -0.57, 0.05, -0.19, -0.12, -0.2, -0.09, -0.04, -0.39, 0.23],
    '#c1bca1'
  )
  poly(ctx, [-0.03, -0.57, 0.59, 0.27, 0.32, 0.23, 0.13, 0.02, 0.18, 0.18, -0.04, -0.04], '#686e65')
  if (snowy)
    poly(
      ctx,
      [
        -0.28, -0.27, -0.03, -0.57, 0.22, -0.23, 0.06, -0.31, 0.08, -0.2, -0.05, -0.29, -0.15, -0.22, -0.13,
        -0.31
      ],
      '#e2e1ce'
    )
  ctx.lineWidth = 0.027
  poly(ctx, [-0.64, 0.28, -0.17, -0.48, -0.03, -0.57, 0.59, 0.27], null, '#666d63')
  ctx.restore()
}
function tree(ctx, x, y, s, broad) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = '#535e4b'
  ctx.fillRect(-0.035, -0.05, 0.07, 0.31)
  if (broad) {
    ctx.fillStyle = '#385a49'
    ctx.beginPath()
    ctx.ellipse(0.025, -0.1, 0.23, 0.24, -0.3, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#6c8f61'
    ctx.beginPath()
    ctx.ellipse(-0.045, -0.15, 0.15, 0.18, 0.1, 0, 2 * Math.PI)
    ctx.fill()
  } else {
    poly(
      ctx,
      [
        -0.25, 0.12, -0.15, -0.06, -0.21, -0.04, -0.11, -0.22, -0.15, -0.21, 0, -0.49, 0.15, -0.21, 0.11,
        -0.22, 0.22, -0.03, 0.15, -0.04, 0.25, 0.12
      ],
      '#355a49'
    )
    poly(ctx, [-0.25, 0.12, -0.1, -0.13, -0.19, -0.05, 0, -0.49, -0.02, -0.16, -0.05, 0.06], '#88a078')
  }
  ctx.restore()
}
function house(ctx, x, y, s) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  poly(ctx, [-0.21, -0.08, 0, -0.17, 0.21, -0.07, 0.21, 0.14, 0, 0.23, -0.21, 0.12], '#cdba91')
  poly(ctx, [0, 0.01, 0.21, -0.07, 0.21, 0.14, 0, 0.23], '#8e8066')
  poly(ctx, [-0.28, -0.04, -0.13, -0.23, 0.1, -0.28, 0.28, -0.08, 0, 0.03], '#615e55')
  poly(ctx, [-0.28, -0.04, -0.13, -0.23, 0.1, -0.28, -0.01, -0.06], '#8a7970')
  ctx.fillStyle = '#695f51'
  ctx.fillRect(-0.11, 0.03, 0.055, 0.13)
  ctx.restore()
}
const stampCache = new Map()
function stamp(type, variant, shade, muted, depth) {
  const key = [type, variant, shade, +muted, depth].join('.')
  if (stampCache.has(key)) return stampCache.get(key)
  const ctx = canvas2d(80, 92)
  ctx.translate(40, 46)
  ctx.scale(44, 44)
  const base = type === 0 ? oceanColors[depth] : colors[type]
  const tint = shade >= 4 ? '#f7e3ad' : '#354b48'
  ctx.fillStyle = mix(base, tint, Math.abs(shade - 4) * 0.052)
  ctx.fill(hexagon)
  ctx.save()
  ctx.clip(hexagon)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const shift = (variant - 1) * 0.075
  ctx.translate(shift, shift * 0.6)
  if (type === 7 || type === 8) {
    mountain(ctx, -0.24, -0.06, 0.86, type === 8)
    mountain(ctx, 0.22, 0.16, 1.14, type === 8 || variant === 1)
  } else if (type === 6) {
    for (let i = 0; i < 2; i++) {
      const x = -0.3 + i * 0.62,
        y = i * 0.14
      ctx.beginPath()
      ctx.moveTo(x - 0.35, y + 0.22)
      ctx.quadraticCurveTo(x, y - 0.45, x + 0.36, y + 0.22)
      ctx.quadraticCurveTo(x + 0.07, y + 0.14, x - 0.35, y + 0.22)
      ctx.fillStyle = '#899369'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x - 0.33, y + 0.18)
      ctx.quadraticCurveTo(x, y - 0.4, x + 0.11, y - 0.05)
      ctx.strokeStyle = '#b8b990'
      ctx.lineWidth = 0.027
      ctx.stroke()
    }
  } else if (type === 2) {
    tree(ctx, 0.01, -0.29, 0.93, variant === 2)
    tree(ctx, -0.32, 0.03, 0.91, variant === 2)
    tree(ctx, 0.28, 0.05, 1.05, variant === 2)
    tree(ctx, -0.02, 0.37, 0.95, variant === 2)
  } else if (type === 4) {
    ctx.lineWidth = 0.035
    ctx.strokeStyle = '#ad9468'
    for (let i = 0; i < 2; i++) {
      const y = i * 0.32 - 0.18
      ctx.beginPath()
      ctx.moveTo(-0.57 + i * 0.28, y + 0.14)
      ctx.bezierCurveTo(-0.21, y + 0.17, -0.1, y - 0.22, 0.42 + i * 0.1, y - 0.03)
      ctx.stroke()
    }
  } else if (type === 0 && variant === 0) {
    ctx.lineWidth = 0.034
    ctx.strokeStyle = depth < 2 ? '#75a5aa' : '#4c7080'
    for (let i = 0; i < 2; i++) {
      ctx.beginPath()
      ctx.moveTo(-0.55 + i * 0.45, 0.12 * i)
      ctx.quadraticCurveTo(-0.32 + i * 0.45, -0.13 + 0.12 * i, -0.12 + i * 0.45, 0.11 * i)
      ctx.stroke()
    }
  } else if ((type === 9 || type === 1) && variant !== 2) {
    ctx.lineWidth = 0.028
    ctx.strokeStyle = type === 9 ? '#818e56' : '#96a16b'
    for (let i = 0; i < 5; i++)
      poly(
        ctx,
        [-0.48 + i * 0.15, 0.25 + i * 0.055, -0.08 + i * 0.15, -0.24 + i * 0.055],
        null,
        ctx.strokeStyle
      )
  } else if (type === 10) {
    house(ctx, 0.02, -0.24, 1.0)
    house(ctx, -0.29, 0.11, 1.02)
    house(ctx, 0.22, 0.2, 1.22)
  } else if (type === 3 || type === 5) {
    ctx.lineWidth = 0.029
    ctx.strokeStyle = type === 5 ? '#658b6f' : '#808e61'
    for (let i = 0; i < 3; i++) {
      let x = -0.4 + i * 0.37,
        y = (i % 2) * 0.42 - 0.2
      poly(ctx, [x - 0.1, y - 0.09, x, y + 0.13, x + 0.09, y - 0.14], null, ctx.strokeStyle)
    }
  }
  ctx.restore()
  if (muted) {
    ctx.fillStyle = 'rgba(43,51,51,.55)'
    ctx.fill(hexagon)
  }
  stampCache.set(key, ctx.canvas)
  return ctx.canvas
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('地形栅格读取失败'))
    img.src = url
  })
}
const defaultDistrictLenses = {
  twPopulation: 'CN-TW',
  twPaddy: 'CN-TW',
  hkPopulation: 'CN-HK',
  moPopulation: 'CN-MO'
}
const detailedZoomLimit = 2400
const isPointLens = (id) => id === 'campus' || id === 'aviation'
const geoName = (text) =>
  String(text || '').replace(/(?:壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市)$/u, '')
const areaNameByCode = Object.fromEntries(
  'BJ北京 TJ天津 HE河北 SX山西 NM内蒙古 LN辽宁 JL吉林 HL黑龙江 SH上海 JS江苏 ZJ浙江 AH安徽 FJ福建 JX江西 SD山东 HA河南 HB湖北 HN湖南 GD广东 GX广西 HI海南 CQ重庆 SC四川 GZ贵州 YN云南 XZ西藏 SN陕西 GS甘肃 QH青海 NX宁夏 XJ新疆 TW台湾 HK香港 MO澳门'
    .split(' ')
    .map((x) => ['CN-' + x.slice(0, 2), x.slice(2)])
)
function buildAtlas(geo, img) {
  const areas = (geo.areas || []).map((a, i) => ({
    ...a,
    i: i + 1,
    zh: areaNameByCode[a.code] || geoName(a.name),
    path: pathFromLines(a.rings, true)
  }))
  const country = pathFromLines(geo.country, true),
    lakes = pathFromLines(geo.lakes, true)
  const borders = pathFromLines(geo.provinces),
    rivers = pathFromLines(geo.rivers)
  const land = pathFromLines(geo.land, true)
  const dx = 0.38
  const mask = canvas2d(Math.ceil((RIGHT - LEFT) * dx), Math.ceil((BOTTOM - TOP) * dx), true)
  mask.setTransform(dx, 0, 0, dx, -LEFT * dx, -TOP * dx)
  mask.fillStyle = 'rgb(1,0,0)'
  mask.fill(land, 'evenodd')
  mask.fillStyle = 'rgb(2,0,0)'
  mask.fill(country, 'evenodd')
  for (const a of areas) {
    mask.fillStyle = 'rgb(2,' + a.i + ',0)'
    mask.fill(a.path, 'evenodd')
  }
  mask.fillStyle = 'rgb(0,0,255)'
  mask.fill(lakes, 'evenodd')
  const md = mask.getImageData(0, 0, mask.canvas.width, mask.canvas.height).data
  const pixels = canvas2d(img.width, img.height, true)
  pixels.drawImage(img, 0, 0)
  const dem = pixels.getImageData(0, 0, img.width, img.height).data
  const [west, south, east, north] = geo.bounds
  const cells = new Array(COLS * ROWS)
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const x = LEFT + (col + (row % 2) * 0.5) * W,
        y = TOP + row * DY
      const [lon, lat] = unproject(x, y)
      if (lon < west || lon > east || lat < south || lat > north) continue
      const mi = 4 * (Math.floor((y - TOP) * dx) * mask.canvas.width + Math.floor((x - LEFT) * dx))
      const di =
        4 *
        (clamp(Math.floor(((north - lat) / (north - south)) * img.height), 0, img.height - 1) * img.width +
          clamp(Math.floor(((lon - west) / (east - west)) * img.width), 0, img.width - 1))
      const isLake = md[mi + 2] > 130,
        area = areas[md[mi + 1] - 1],
        inside = md[mi] >= 2
      let type = isLake || !md[mi] ? 0 : dem[di] || 1
      if (type >= colors.length) type = 1
      const hash = noise(col, row)
      const shade = type
        ? clamp(Math.round(4 + (dem[di + 1] - 128) / 28 + ((hash % 5) - 2) * 0.53), 0, 8)
        : 4
      const elevation = dem[di + 2] * 32
      const edge = Math.min(lon - west, east - lon, (north - lat) * 1.25, (lat - south) * 1.25)
      const fade = inside ? 0 : clamp(1 - edge / 2.5, 0, 1)
      cells[row * COLS + col] = {
        x,
        y,
        lon,
        lat,
        row,
        col,
        area,
        inside,
        isLake,
        type,
        shade,
        elevation,
        variant: (hash >>> 9) % 3,
        depth: 5,
        fade
      }
    }
  // Hex-neighbour distance produces a shallow-to-deep shelf around the coasts.
  for (let depth = 0; depth < 5; depth++) {
    for (const c of cells) {
      if (!c || c.type || c.depth !== 5) continue
      const i = c.row * COLS + c.col,
        shift = c.row % 2 ? 1 : -1
      const neighbours = [i - 1, i + 1, i - COLS, i + COLS, i - COLS + shift, i + COLS + shift]
      if (
        neighbours.some(
          (j) =>
            cells[j] && (depth === 0 ? cells[j].type !== 0 : !cells[j].type && cells[j].depth === depth - 1)
        )
      )
        c.depth = depth
    }
  }
  return { cells, areas, country, lakes, borders, rivers, land }
}
function elevationBand(e) {
  if (e < 200) return 0
  if (e < 500) return 1
  if (e < 1500) return 2
  if (e < 3000) return 3
  return e < 5000 ? 4 : 5
}
function paintCell(ctx, c, detail) {
  if (!c) return
  const muted = !c.inside && !!c.type
  const t = stamp(c.type, c.variant, c.shade, muted, c.type === 0 ? c.depth : 0)
  // Stamp includes transparent corners. A half-pixel overlap avoids hairline cracks.
  const fx = (R * (detail ? 1.013 : 1.05)) / 44
  ctx.drawImage(t, c.x - 40 * fx, c.y - 46 * fx, 80 * fx, 92 * fx)
  if (c.fade > 0.03) {
    ctx.fillStyle = 'rgba(29,47,58,' + c.fade + ')'
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(R * 1.03, R * 1.03)
    ctx.fill(hexagon)
    ctx.restore()
  }
}
function makeOverview(cells) {
  const scale = 0.38
  const ctx = canvas2d(Math.ceil((RIGHT - LEFT) * scale), Math.ceil((BOTTOM - TOP) * scale))
  ctx.setTransform(scale, 0, 0, scale, -LEFT * scale, -TOP * scale)
  for (const c of cells) paintCell(ctx, c, false)
  return ctx.canvas
}
export async function createMap(
  canvas,
  {
    places = [],
    provinces = [],
    twLocalities = [],
    districts = [],
    districtLenses = {},
    onSelect,
    onHover,
    onView,
    onReady
  } = {}
) {
  const [geo, img] = await Promise.all([
    fetch(new URL('./data/geography.json', import.meta.url)).then((r) => {
      if (!r.ok) throw new Error('地图资料读取失败')
      return r.json()
    }),
    loadImage(new URL('./data/relief.png', import.meta.url))
  ])
  const atlas = buildAtlas(geo, img),
    base = makeOverview(atlas.cells)
  const ctx = canvas.getContext('2d', { alpha: false })
  const locations = places
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
    .map((p, i) => {
      const [x, y] = project(p.lon, p.lat)
      return { p, x, y, order: i, rank: p.rank ?? 3, landmark: p.kind === 'landmark' }
    })
    .sort((a, b) => a.rank - b.rank || (b.p.population || 0) - (a.p.population || 0) || a.order - b.order)
  const hitContext = canvas2d(1, 1)
  const localProvinces = { ...defaultDistrictLenses, ...districtLenses }
  const localAreas = new Map()
  const areaById = new Map()
  const outlines = new Map()
  function addArea(place, province) {
    const anchor = project(place.lon, place.lat)
    const path = new Path2D()
    const bounds = [anchor[0], anchor[1], anchor[0], anchor[1]]
    for (const ring of place.rings || []) {
      for (const [i, point] of ring.entries()) {
        const [x, y] = project(...point)
        if (i) path.lineTo(x, y)
        else path.moveTo(x, y)
        bounds[0] = Math.min(bounds[0], x)
        bounds[1] = Math.min(bounds[1], y)
        bounds[2] = Math.max(bounds[2], x)
        bounds[3] = Math.max(bounds[3], y)
      }
      path.closePath()
    }
    if (!localAreas.has(province)) localAreas.set(province, [])
    const area = { place, province, path, bounds, anchor }
    areaById.set(place.id, area)
    localAreas.get(province).push(area)
    if (place.rings?.length) {
      if (!outlines.has(province)) outlines.set(province, new Path2D())
      outlines.get(province).addPath(path)
    }
  }
  for (const place of twLocalities) addArea(place, 'CN-TW')
  for (const place of districts) addArea(place, place.province)
  const allAreas = [...areaById.values()]
  const pointsByLens = {}
  for (const kind of ['campus', 'aviation']) {
    const points = locations.filter((o) => o.p.kind === kind)
    points.sort((a, b) => (b.p.count || 0) - (a.p.count || 0))
    pointsByLens[kind] = { points, max: Math.max(1, points[0]?.p.count || 0) }
  }
  const regions = provinces.map((p) => ({ ...p, point: project(p.lon, p.lat) }))
  const landmarks = anchors.map(([name, lon, lat]) => ({ name, point: project(lon, lat) }))
  let width = 0,
    height = 0,
    dpr = 1,
    fit = 0.15
  let zoom = 1,
    cx = -85,
    cy = -45,
    frame = 0,
    motion = 0,
    disposed = false,
    lens = 'terrain',
    lensColors = {}
  let selected = null,
    highlight = null,
    hovered = null,
    hits = [],
    press = null,
    dragging = false,
    oldPinch = null,
    wantsView = true
  const layers = {
    cities: true,
    labels: true,
    boundaries: true,
    rivers: true,
    terrain: true,
    landmarks: true,
    grid: false
  }
  const pointers = new Map()
  const initialTouchAction = canvas.style.touchAction
  canvas.style.touchAction = 'none'
  const scale = () => fit * zoom
  const activeAreas = () => localAreas.get(localProvinces[lens])
  const isDistrictLens = () => localProvinces[lens] === 'CN-HK' || localProvinces[lens] === 'CN-MO'
  const userZoomLimit = () => (isDistrictLens() ? detailedZoomLimit : Math.max(24, zoom))
  function toScreen(x, y) {
    const s = scale()
    return [(x - cx) * s + width / 2, (y - cy) * s + height / 2]
  }
  function fromScreen(x, y) {
    const s = scale()
    return [(x - width / 2) / s + cx, (y - height / 2) / s + cy]
  }
  const getView = () => {
    const [lon, lat] = unproject(cx, cy)
    return { lon, lat, zoom }
  }
  function getBounds() {
    const coordinates = []
    for (const u of [0, 0.25, 0.5, 0.75, 1])
      for (const v of [0, 1]) {
        coordinates.push(
          unproject(...fromScreen(width * u, height * v)),
          unproject(...fromScreen(width * v, height * u))
        )
      }
    return {
      west: Math.min(...coordinates.map((p) => p[0])),
      east: Math.max(...coordinates.map((p) => p[0])),
      north: Math.max(...coordinates.map((p) => p[1])),
      south: Math.min(...coordinates.map((p) => p[1]))
    }
  }
  function queue(viewChanged = false) {
    if (disposed) return
    if (viewChanged) wantsView = true
    if (!frame) frame = requestAnimationFrame(render)
  }
  function setCamera(x, y, z) {
    const level = clamp(z, 0.8, detailedZoomLimit)
    // Keep the centre inside the map, including when a gesture ends beyond an edge.
    const [lon, lat] = unproject(clamp(x, LEFT + 100, RIGHT - 100), clamp(y, TOP + 100, BOTTOM - 100))
    const b = geo.bounds
    ;[cx, cy] = project(clamp(lon, b[0] + 0.6, b[2] - 0.6), clamp(lat, b[1] + 0.6, b[3] - 0.6))
    zoom = level
    queue(true)
  }
  function stopMotion() {
    if (motion) cancelAnimationFrame(motion)
    motion = 0
  }
  function flyTo(lon, lat, z = 4, animate = true) {
    if (![lon, lat, z].every(Number.isFinite)) return
    stopMotion()
    const [x, y] = project(
      clamp(lon, geo.bounds[0], geo.bounds[2]),
      clamp(lat, geo.bounds[1], geo.bounds[3])
    )
    const target = clamp(z, 0.8, detailedZoomLimit)
    if (!animate || reducedMotion()) {
      setCamera(x, y, target)
      return
    }
    const x0 = cx,
      y0 = cy,
      z0 = zoom,
      start = performance.now()
    function progress(t) {
      const v = clamp((t - start) / 390, 0, 1),
        ease = 1 - (1 - v) ** 3
      setCamera(x0 + (x - x0) * ease, y0 + (y - y0) * ease, z0 * (target / z0) ** ease)
      if (v < 1) motion = requestAnimationFrame(progress)
      else motion = 0
    }
    motion = requestAnimationFrame(progress)
  }
  function zoomAt(multiplier, x = width / 2, y = height / 2) {
    stopMotion()
    const before = fromScreen(x, y),
      target = clamp(zoom * multiplier, 0.8, userZoomLimit()),
      s = target * fit
    setCamera(before[0] - (x - width / 2) / s, before[1] - (y - height / 2) / s, target)
  }
  function fitAreas(areas, animate, panel) {
    if (!areas?.length || !width || !height) return
    const x0 = Math.min(...areas.map(({ bounds }) => bounds[0]))
    const y0 = Math.min(...areas.map(({ bounds }) => bounds[1]))
    const x1 = Math.max(...areas.map(({ bounds }) => bounds[2]))
    const y1 = Math.max(...areas.map(({ bounds }) => bounds[3]))
    const mapRect = canvas.getBoundingClientRect()
    const legend = canvas.parentElement?.querySelector('#legend:not([hidden])')?.getBoundingClientRect()
    const bottomInset = width < 700 && legend?.height ? height - (legend.top - mapRect.top) : 65
    let frame = [16, 48, width - 16, Math.max(72, height - bottomInset - 10)]
    const dx = Math.max(x1 - x0, 0.7)
    const dy = Math.max(y1 - y0, 0.7)
    const frameScale = ([l, t, r, b]) => Math.min((r - l) / dx, (b - t) / dy)
    if (panel && !panel.hidden) {
      const rect = panel.getBoundingClientRect()
      const [l, t, r, b] = frame
      const right = [Math.max(l, rect.right - mapRect.left + 12), t, r, b]
      const below = [l, Math.max(t, rect.bottom - mapRect.top + 12), r, b]
      const available = frameScale(right) > frameScale(below) ? right : below
      if (frameScale(available) > 0) frame = available
    }
    const level = clamp((frameScale(frame) * 0.84) / fit, 0.8, detailedZoomLimit)
    const s = fit * level
    const x = (x0 + x1) / 2 - (frame[0] + frame[2] - width) / 2 / s
    const y = (y0 + y1) / 2 - (frame[1] + frame[3] - height) / 2 / s
    flyTo(...unproject(x, y), level, animate)
  }
  function reset(animate = true) {
    const [lon, lat] = unproject(-85, -45)
    flyTo(lon, lat, 1, animate)
  }
  function resize() {
    const first = !width
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    width = rect.width
    height = rect.height
    dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    fit = Math.min(width / (width < 600 ? 5270 : 5650), height / 4580)
    if (first && width < 600 && height > width * 1.13) {
      zoom = 1.65
      ;[cx, cy] = project(108, 35)
    }
    queue(true)
  }
  function worldTransform() {
    const s = scale() * dpr
    ctx.setTransform(s, 0, 0, s, (dpr * width) / 2 - s * cx, (dpr * height) / 2 - s * cy)
  }
  function visibleCells(fn) {
    const [xl, yt] = fromScreen(-15, -15),
      [xr, yb] = fromScreen(width + 15, height + 15)
    const first = clamp(Math.floor((yt - TOP) / DY) - 1, 0, ROWS),
      last = clamp(Math.ceil((yb - TOP) / DY) + 1, 0, ROWS)
    const low = clamp(Math.floor((xl - LEFT) / W) - 2, 0, COLS),
      high = clamp(Math.ceil((xr - LEFT) / W) + 1, 0, COLS)
    for (let row = first; row < last; row++)
      for (let col = low; col < high; col++) {
        const c = atlas.cells[row * COLS + col]
        if (c) fn(c)
      }
  }
  function fillCell(c, color) {
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(R * 1.015, R * 1.015)
    ctx.fillStyle = color
    ctx.fill(hexagon)
    ctx.restore()
  }
  function strokePath(path, color, pixels, dash = []) {
    ctx.strokeStyle = color
    ctx.lineWidth = pixels / scale()
    ctx.setLineDash(dash.map((d) => d / scale()))
    ctx.stroke(path)
    ctx.setLineDash([])
  }
  function paintWorld() {
    worldTransform()
    const districtDetail = isDistrictLens() && scale() > 1.8
    if (districtDetail) {
      // The national shoreline is generalized at 1:50m. At district scale the
      // neutral surround keeps the survey polygons readable down to small islands.
      ctx.fillStyle = '#344c54'
      const [x0, y0] = fromScreen(0, 0)
      ctx.fillRect(x0, y0, width / scale(), height / scale())
    } else if (scale() < 0.48 || !layers.terrain) ctx.drawImage(base, LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP)
    else visibleCells((c) => paintCell(ctx, c, true))
    if (!layers.terrain && !districtDetail) {
      ctx.fillStyle = '#819382'
      ctx.fill(atlas.land, 'evenodd')
      ctx.fillStyle = '#babc94'
      ctx.fill(atlas.country, 'evenodd')
      ctx.fillStyle = '#3d6f80'
      ctx.fill(atlas.lakes, 'evenodd')
    }
    if (lens === 'elevation' || lens === 'landcover') {
      ctx.globalAlpha = 0.82
      visibleCells((c) => {
        if (c.inside && c.type)
          fillCell(c, lens === 'elevation' ? elevationColors[elevationBand(c.elevation)] : colors[c.type])
      })
      ctx.globalAlpha = 1
    } else if (activeAreas()) {
      for (const area of activeAreas()) {
        ctx.fillStyle = lensColors[area.place.id] || '#8d9085'
        ctx.fill(area.path, 'evenodd')
      }
    } else if (lens !== 'terrain' && lens !== 'cities' && !isPointLens(lens)) {
      ctx.globalAlpha = 0.83
      for (const a of atlas.areas) {
        ctx.fillStyle = lensColors[a.code] || lensColors[a.name] || lensColors[a.zh] || '#918f7e'
        ctx.fill(outlines.get(a.code) || a.path, 'evenodd')
      }
      ctx.globalAlpha = 1
    }
    if (layers.grid || (scale() > 0.95 && !districtDetail)) {
      const gridPath = new Path2D()
      visibleCells((c) => {
        if (c.fade > 0.45) return
        const x = c.x,
          y = c.y
        gridPath.moveTo(x, y - R)
        gridPath.lineTo(x + W / 2, y - R / 2)
        gridPath.lineTo(x + W / 2, y + R / 2)
        gridPath.lineTo(x, y + R)
      })
      strokePath(
        gridPath,
        layers.grid ? 'rgba(42,51,48,.48)' : 'rgba(42,51,48,.21)',
        layers.grid ? 0.65 : 0.5
      )
    }
    if (layers.rivers && !districtDetail) {
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      strokePath(atlas.rivers, 'rgba(28,78,88,.76)', clamp(0.65 * Math.sqrt(zoom), 0.65, 2.25))
      if (zoom > 2.5)
        strokePath(atlas.rivers, 'rgba(116,175,182,.85)', clamp(0.35 * Math.sqrt(zoom), 0.4, 1.2))
    }
    if (layers.boundaries && !districtDetail) {
      ctx.lineJoin = 'round'
      if (!activeAreas()) {
        strokePath(atlas.country, 'rgba(52,58,42,.84)', clamp(1.8 * Math.sqrt(zoom), 1.7, 3))
        strokePath(atlas.country, '#d7c078', clamp(0.95 * Math.sqrt(zoom), 0.8, 1.7))
      }
      strokePath(
        atlas.borders,
        'rgba(61,60,43,.8)',
        clamp(0.62 * Math.sqrt(zoom), 0.6, 1.35),
        zoom > 1.7 ? [3, 1.4] : []
      )
    }
    if (activeAreas()) {
      const pointed = hovered?.place?.id
      const active = selected?.place?.id
      for (const area of activeAreas()) {
        if (layers.boundaries) strokePath(area.path, 'rgba(44,56,51,.86)', 0.85)
      }
      for (const area of activeAreas()) {
        if (area.place.id === active || area.place.id === pointed) {
          strokePath(area.path, '#394543', 3)
          strokePath(area.path, area.place.id === active ? '#fee197' : '#fff2cd', 1.5)
        }
      }
    }
    if (highlight) {
      ctx.fillStyle = 'rgba(255,228,144,.19)'
      ctx.fill(highlight, 'evenodd')
      strokePath(highlight, 'rgba(49,48,34,.95)', 3.8)
      strokePath(highlight, '#ffe19a', 2)
    }
    if (selected?.cell && !activeAreas()) {
      const c = selected.cell
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.scale(R, R)
      ctx.strokeStyle = '#303d36'
      ctx.lineWidth = 3 / (R * scale())
      ctx.stroke(hexagon)
      ctx.strokeStyle = '#ffe49b'
      ctx.lineWidth = 1.55 / (R * scale())
      ctx.stroke(hexagon)
      ctx.restore()
    }
  }
  function sizeFor(rank) {
    return rank === 0 ? 4.8 : rank === 1 ? 3.6 : rank === 2 ? 2.6 : 2.1
  }
  const badgeColors = ['#c09262', '#7fa9ac', '#91a377', '#af987e', '#819b9a', '#b38475', '#8995ae']
  const rankBadge = (rank, landmark) => (landmark ? '✧' : rank === 0 ? '★' : '◆')
  function drawPointLens() {
    const { points, max } = pointsByLens[lens]
    const campus = lens === 'campus'
    const active = selected?.place?.id
    const visible = []
    for (const { p, x: worldX, y: worldY } of points) {
      const [x, y] = toScreen(worldX, worldY)
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue
      // A legible minimum icon area plus an area proportional to the city count.
      const relative = clamp((p.count || 0) / max, 0, 1)
      const r = Math.sqrt(36 + 220 * relative)
      visible.push({ p, x, y, r })
    }
    const occupied = visible.map(({ x, y, r }) => ({ l: x - r, r: x + r, t: y - r, b: y + r }))
    const selectedIndex = visible.findIndex(({ p }) => p.id === active)
    if (selectedIndex > 0) visible.unshift(...visible.splice(selectedIndex, 1))
    for (const { p, x, y, r } of [...visible].reverse()) {
      ctx.save()
      ctx.translate(x, y)
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, 2 * Math.PI)
      ctx.fillStyle = campus ? '#6a4f78' : '#2d647a'
      ctx.fill()
      ctx.lineWidth = p.id === active ? 2.4 : 1.2
      ctx.strokeStyle = p.id === active ? '#ffe19a' : '#ded3af'
      ctx.stroke()
      ctx.scale(r / 11, r / 11)
      ctx.fillStyle = '#fcf1cb'
      if (campus) {
        poly(ctx, [-8, -1, 0, -5, 8, -1, 0, 2.5], ctx.fillStyle)
        poly(ctx, [-4.8, 1.7, 0, 3.8, 4.8, 1.7, 4.8, 4.5, 0, 6.4, -4.8, 4.5], ctx.fillStyle)
        ctx.fillRect(6.4, 0, 1, 4.2)
      } else {
        poly(
          ctx,
          [
            0, -8, 1.4, -6.2, 1.4, -1.8, 7.4, 2.4, 7.4, 4, 1.3, 2.2, 1, 5.2, 3.4, 7, 3.4, 8, 0, 7.1, -3.4,
            8, -3.4, 7, -1, 5.2, -1.3, 2.2, -7.4, 4, -7.4, 2.4, -1.4, -1.8, -1.4, -6.2
          ],
          ctx.fillStyle
        )
      }
      ctx.restore()
      hits.push({ p, l: x - r - 2, r: x + r + 2, t: y - r - 2, b: y + r + 2 })
    }
    if (!layers.labels) return
    ctx.font = '600 12px ' + labelFont
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const maxLabels = Math.max(7, Math.ceil((width * height) / 22000))
    let drawn = 0
    for (const { p, x, y, r } of visible) {
      if (drawn >= maxLabels) break
      const w = ctx.measureText(p.name).width + 10,
        h = 18
      const positions = [
        [x + r + 2, y - h / 2],
        [x - w / 2, y - h - r - 2],
        [x - w - r - 2, y - h / 2],
        [x - w / 2, y + r + 2]
      ]
      const spot = positions.find(
        ([l, t]) =>
          l >= 2 &&
          l + w <= width - 2 &&
          t >= 2 &&
          t + h <= height - 2 &&
          !occupied.some((a) => l < a.r && l + w > a.l && t < a.b && t + h > a.t)
      )
      if (!spot) continue
      const [l, t] = spot
      ctx.beginPath()
      ctx.roundRect(l + 0.5, t + 0.5, w - 1, h - 1, 3)
      ctx.fillStyle = campus ? '#3a3243' : '#263d48'
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = p.id === active ? '#ffe19a' : '#b2a989'
      ctx.stroke()
      ctx.fillStyle = '#fcf5dc'
      ctx.fillText(p.name, l + 5, t + h / 2 + 0.5)
      occupied.push({ l: l - 3, r: l + w + 3, t: t - 2, b: t + h + 2 })
      hits.push({ p, l, r: l + w, t, b: t + h })
      drawn++
    }
    ctx.textBaseline = 'alphabetic'
  }
  function drawDivisionLabels(areas) {
    const anchors = areas
      .map(({ place, anchor }) => {
        const [x, y] = toScreen(...anchor)
        return { place, x, y }
      })
      .filter(({ x, y }) => x >= -8 && y >= -8 && x <= width + 8 && y <= height + 8)
    const occupied = anchors.map(({ x, y }) => ({ l: x - 3, t: y - 3, r: x + 3, b: y + 3 }))
    const selectedId = selected?.place?.id
    anchors.sort(
      (a, b) =>
        Number(b.place.id === selectedId) - Number(a.place.id === selectedId) ||
        (b.place.population || 0) - (a.place.population || 0)
    )
    for (const { place, x, y } of anchors) {
      ctx.fillStyle = '#293d41'
      ctx.strokeStyle = '#f7e7bf'
      ctx.lineWidth = 0.85
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      hits.push({ p: place, l: x - 3, t: y - 3, r: x + 3, b: y + 3 })
    }
    if (!layers.labels) return
    const h = 16
    ctx.font = '600 12px ' + labelFont
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    for (const { place, x, y } of anchors) {
      const w = ctx.measureText(place.name).width + 8
      const positions = [
        [4, -h / 2],
        [-w - 4, -h / 2],
        [-w / 2, -h - 4],
        [-w / 2, 4],
        [6, -h - 7],
        [-w - 6, 7],
        [12, 9],
        [-w - 12, -h - 9]
      ]
      const offset = positions.find(([dx, dy]) => {
        const l = x + dx,
          t = y + dy
        return (
          l >= 1 &&
          t >= 1 &&
          l + w < width &&
          t + h < height &&
          !occupied.some((a) => l < a.r && l + w > a.l && t < a.b && t + h > a.t)
        )
      })
      if (!offset) continue
      const l = x + offset[0],
        t = y + offset[1]
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(clamp(x, l, l + w), clamp(y, t, t + h))
      ctx.lineWidth = 1
      ctx.strokeStyle = '#4e584c'
      ctx.stroke()
      ctx.beginPath()
      ctx.roundRect(l + 0.5, t + 0.5, w - 1, h - 1, 2.5)
      ctx.fillStyle = 'rgba(37,51,48,.88)'
      ctx.fill()
      ctx.strokeStyle = place.id === selectedId ? '#ffe197' : '#b6b69b'
      ctx.stroke()
      ctx.fillStyle = '#fff4d3'
      ctx.fillText(place.name, l + 4, t + h / 2)
      occupied.push({ l: l - 2, t: t - 1, r: l + w + 2, b: t + h + 1 })
      hits.push({ p: place, l, r: l + w, t, b: t + h })
    }
    ctx.textBaseline = 'alphabetic'
  }
  function drawMarks() {
    hits = []
    if (activeAreas()) {
      drawDivisionLabels(activeAreas())
      return
    }
    if (isPointLens(lens)) {
      drawPointLens()
      return
    }
    const occupied = []
    const labels = [],
      wonderMarks = []
    const activePlace = selected?.place
    const addHit = (p, x, y, r) => hits.push({ p, l: x - r, r: x + r, t: y - r, b: y + r })
    const collides = (x, y, w, h) => occupied.some((a) => x < a.r && x + w > a.l && y < a.b && y + h > a.t)
    const use = (x, y, w, h) => occupied.push({ l: x - 3, r: x + w + 3, t: y - 2, b: y + h + 2 })
    const maxRank = zoom > 3 ? 5 : zoom > 1.5 ? 3 : 2
    const maxLabels = Math.ceil((width * height) / (zoom > 2 ? 16000 : 20500))
    for (const o of locations) {
      const p = o.p,
        isSelected = p.id === activePlace?.id
      if (isPointLens(p.kind)) continue
      if (!isSelected && ((o.landmark && !layers.landmarks) || (!o.landmark && !layers.cities))) continue
      const [x, y] = toScreen(o.x, o.y)
      if (x < -5 || x > width + 5 || y < -4 || y > height + 4) continue
      if (!o.landmark && o.rank > maxRank && !isSelected && lens !== 'cities') continue
      if (
        o.landmark &&
        !isSelected &&
        wonderMarks.some(([mx, my]) => Math.hypot(mx - x, my - y) < (zoom < 2 ? 21 : 15))
      )
        continue
      const accent =
        badgeColors[
          o.rank === 0 ? 0 : (noise(Math.round(p.lon), Math.round(p.lat)) % (badgeColors.length - 1)) + 1
        ]
      let r = o.landmark ? 6.4 : sizeFor(o.rank)
      if (lens === 'cities') r += 1.5
      if (isSelected) r += 1
      ctx.save()
      ctx.translate(x, y)
      ctx.strokeStyle = '#423f31'
      ctx.fillStyle = o.landmark ? '#dbc482' : accent
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
      if (o.landmark) {
        wonderMarks.push([x, y])
        ctx.strokeStyle = '#faeabe'
        ctx.lineWidth = 0.55
        ctx.beginPath()
        ctx.arc(0, 0, r - 1.4, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.fillStyle = '#504934'
        if (/natural|自然/i.test(p.type)) {
          poly(ctx, [-3.7, 2.3, -0.8, -2.8, 0.4, -0.4, 1.7, -1.9, 3.8, 2.3], ctx.fillStyle)
        } else {
          poly(ctx, [-3.9, -0.45, -1.6, -1.55, 0, -3.1, 1.6, -1.55, 3.9, -0.45], ctx.fillStyle)
          ctx.fillRect(-2.7, 0, 0.85, 2)
          ctx.fillRect(-0.4, 0, 0.8, 2)
          ctx.fillRect(1.85, 0, 0.85, 2)
          ctx.fillRect(-3.3, 2, 6.6, 0.8)
        }
      } else if (o.rank < 2) {
        ctx.fillStyle = '#eee6bd'
        ctx.beginPath()
        ctx.arc(0, 0, r * 0.37, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.restore()
      addHit(p, x, y, Math.max(r + 3, 7))
      if (!layers.labels || (!isSelected && labels.length >= maxLabels)) continue
      const cap = (!o.landmark && o.rank < 2) || isSelected
      if (o.landmark && !isSelected && zoom < 4.5) continue
      if (!cap && zoom < (o.rank > 2 ? 3.4 : 1.65)) continue
      const fontSize = o.rank === 0 ? 15 : cap ? 13 : 12
      const font = '600 ' + fontSize + 'px ' + labelFont
      ctx.font = font
      const bannerPopulation = p.registryLocality?.population ?? p.regionalPopulation ?? p.population
      const badge =
        !o.landmark && width >= 600 && bannerPopulation >= 900000
          ? Math.round(bannerPopulation / 10000) + '万'
          : rankBadge(o.rank, o.landmark)
      const badgeWidth = badge.length > 1 ? badge.length * 6.6 + 7 : 17
      const h = cap ? 20 : 16,
        w = ctx.measureText(p.name).width + (cap ? badgeWidth + 10 : 7)
      const positions = [
        [-w / 2, -h - 6],
        [-w / 2, 7],
        [6, -h / 2],
        [-w - 6, -h / 2]
      ]
      const spot = positions.find(
        ([dx, dy]) =>
          x + dx >= 2 &&
          x + dx + w <= width - 2 &&
          y + dy >= 2 &&
          y + dy + h <= height - 2 &&
          !collides(x + dx, y + dy, w, h)
      )
      if (!spot && !isSelected) continue
      const [dx, dy] = spot || positions[0],
        l = x + dx,
        t = y + dy
      use(l, t, w, h)
      labels.push({ p, x, y, l, t, w, h, accent, cap, font, isSelected, badge, badgeWidth })
    }
    // Faint geographic type sits behind city banners and yields to them on collision.
    if (layers.labels) {
      const hasCities = layers.cities
      function regionalLabel(text, point, size, color, pad) {
        const [x, y] = toScreen(...point)
        if (x < 0 || y < 0 || x > width || y > height) return
        ctx.font = '600 ' + size + 'px ' + labelFont
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const w = ctx.measureText(text).width
        if (collides(x - w / 2 - pad, y - size / 2 - pad, w + pad * 2, size + pad * 2)) return
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.3
        ctx.strokeStyle = 'rgba(44,49,38,.50)'
        ctx.strokeText(text, x, y)
        ctx.fillStyle = color
        ctx.fillText(text, x, y)
        use(x - w / 2 - pad, y - size / 2 - pad, w + 2 * pad, size + 2 * pad)
      }
      if (zoom < 5)
        for (const label of landmarks)
          regionalLabel(label.name, label.point, clamp(width / 86, 10, 16), 'rgba(242,232,197,.70)', 2)
      if (zoom < 6 || !hasCities)
        for (const p of regions)
          regionalLabel(geoName(p.name), p.point, clamp(width / 80, 12, 19), 'rgba(246,232,197,.80)', 4)
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const d of labels) {
      const { p, x, y, l, t, w, h, accent, cap, font, isSelected, badge, badgeWidth } = d
      ctx.font = font
      if (cap) {
        ctx.strokeStyle = '#575543'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(clamp(x, l, l + w), clamp(y, t, t + h))
        ctx.stroke()
        ctx.beginPath()
        ctx.roundRect(l + 0.5, t + 0.5, w - 1, h - 1, 3)
        ctx.fillStyle = 'rgba(32,42,39,.96)'
        ctx.fill()
        ctx.lineWidth = isSelected ? 1.8 : 1
        ctx.strokeStyle = isSelected ? '#ffdf88' : accent
        ctx.stroke()
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.roundRect(l + 0.8, t + 0.8, badgeWidth, h - 1.6, [2.3, 0, 0, 2.3])
        ctx.fill()
        ctx.font = 'bold 10px system-ui'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#263b3c'
        ctx.fillText(badge, l + badgeWidth / 2 + 1, t + h / 2 + 0.6)
        ctx.font = font
        ctx.textAlign = 'left'
        ctx.fillStyle = '#fcf5dc'
        ctx.fillText(p.name, l + badgeWidth + 4, t + h / 2 + 0.6)
      } else {
        ctx.lineWidth = 2.8
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#eeebd1'
        ctx.strokeText(p.name, l + 3, t + h / 2)
        ctx.fillStyle = '#2e403d'
        ctx.fillText(p.name, l + 3, t + h / 2)
      }
      hits.push({ p, l, r: l + w, t, b: t + h })
    }
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
  }
  function render() {
    frame = 0
    if (!width || !height || disposed) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#1d2f3a'
    ctx.fillRect(0, 0, width, height)
    paintWorld()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawMarks()
    if (wantsView) {
      wantsView = false
      onView?.(getView())
    }
  }
  function nearestCell(x, y) {
    const row = Math.round((y - TOP) / DY)
    let d = Infinity,
      best = null
    for (let j = row - 1; j <= row + 1; j++) {
      if (j < 0 || j >= ROWS) continue
      const col = Math.round((x - LEFT) / W - (j % 2) * 0.5)
      for (let k = col - 1; k <= col + 1; k++) {
        if (k < 0 || k >= COLS) continue
        const c = atlas.cells[j * COLS + k]
        if (!c) continue
        const dist = (x - c.x) ** 2 + (y - c.y) ** 2
        if (dist < d) {
          best = c
          d = dist
        }
      }
    }
    return d < R ** 2 * 1.01 ? best : null
  }
  function resultAt(x, y, override, onlyTerrain = false) {
    const rect = canvas.getBoundingClientRect()
    let place = override
    if (!place && !onlyTerrain)
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i]
        if (x >= h.l && x <= h.r && y >= h.t && y <= h.b) {
          place = h.p
          break
        }
      }
    const world = place ? project(place.lon, place.lat) : fromScreen(x, y)
    const [lon, lat] = place ? [place.lon, place.lat] : unproject(...world)
    const trueArea =
      areaById.get(place?.id) ||
      allAreas.find(
        ({ bounds, path }) =>
          world[0] >= bounds[0] &&
          world[1] >= bounds[1] &&
          world[0] <= bounds[2] &&
          world[1] <= bounds[3] &&
          hitContext.isPointInPath(path, ...world, 'evenodd')
      )
    if (!place && trueArea && trueArea.province === localProvinces[lens] && !onlyTerrain)
      place = trueArea.place
    if (!place && !onlyTerrain && isDistrictLens()) return null
    const cell = nearestCell(...world)
    const placeCode = place?.kind === 'province' ? place.id : place?.province
    const provinceCode =
      trueArea?.province || (areaNameByCode[placeCode] && placeCode) || cell?.area?.code || null
    if (!cell && !place) return null
    return {
      lon,
      lat,
      terrain: cell?.isLake ? '湖泊' : terrainNames[cell?.type ?? 0],
      elevation: cell && (cell.type || cell.isLake) ? cell.elevation : null,
      province: areaNameByCode[provinceCode] || cell?.area?.zh || null,
      twLocality: trueArea?.province === 'CN-TW' ? trueArea.place : undefined,
      district: trueArea && trueArea.province !== 'CN-TW' ? trueArea.place : undefined,
      provinceCode,
      place: place || null,
      x: rect.left + x,
      y: rect.top + y,
      mapX: x,
      mapY: y,
      cell
    }
  }
  function local(e) {
    const rect = canvas.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }
  function pinchInfo() {
    const [a, b] = [...pointers.values()]
    return {
      x: (a[0] + b[0]) / 2,
      y: (a[1] + b[1]) / 2,
      d: Math.max(8, Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
  }
  function clearHover() {
    if (hovered || onHover) {
      if (activeAreas() && hovered?.place) queue()
      hovered = null
      onHover?.(null)
    }
  }
  function down(e) {
    if (e.button !== 0) return
    stopMotion()
    const pos = local(e)
    pointers.set(e.pointerId, pos)
    canvas.setPointerCapture(e.pointerId)
    clearHover()
    if (pointers.size === 1) {
      press = { x: pos[0], y: pos[1], cx, cy }
      dragging = false
    } else if (pointers.size === 2) {
      oldPinch = pinchInfo()
      dragging = true
    }
    canvas.style.cursor = 'grabbing'
  }
  function move(e) {
    const [x, y] = local(e)
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'touch') return
      const previous = hovered?.place?.id
      hovered = resultAt(x, y)
      if (activeAreas() && previous !== hovered?.place?.id) queue()
      canvas.style.cursor = hovered?.place ? 'pointer' : 'grab'
      onHover?.(hovered)
      return
    }
    pointers.set(e.pointerId, [x, y])
    if (pointers.size >= 2 && oldPinch) {
      const current = pinchInfo(),
        before = fromScreen(oldPinch.x, oldPinch.y),
        z = clamp((zoom * current.d) / oldPinch.d, 0.8, userZoomLimit())
      setCamera(
        before[0] - (current.x - width / 2) / (z * fit),
        before[1] - (current.y - height / 2) / (z * fit),
        z
      )
      oldPinch = current
    } else if (press) {
      const dx = x - press.x,
        dy = y - press.y
      if (Math.hypot(dx, dy) > 4) dragging = true
      if (dragging) setCamera(press.cx - dx / scale(), press.cy - dy / scale(), zoom)
    }
  }
  function up(e) {
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    if (e.type === 'pointerup' && !dragging && press) {
      selected = resultAt(...local(e))
      onSelect?.(selected)
      queue()
    }
    if (pointers.size === 1) {
      const [x, y] = [...pointers.values()][0]
      press = { x, y, cx, cy }
      oldPinch = null
      dragging = true
    } else if (!pointers.size) {
      dragging = false
      press = null
      oldPinch = null
      canvas.style.cursor = 'grab'
    }
  }
  function doubleClick(e) {
    e.preventDefault()
    zoomAt(1.7, ...local(e))
  }
  function wheel(e) {
    e.preventDefault()
    clearHover()
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1)
    zoomAt(Math.exp(-clamp(delta, -180, 180) * 0.0025), ...local(e))
  }
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: up,
    pointerleave: clearHover,
    dblclick: doubleClick,
    wheel
  }
  for (const [name, handler] of Object.entries(handlers))
    canvas.addEventListener(name, handler, { passive: name !== 'wheel' && name !== 'dblclick' })
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  render()
  const api = {
    getView,
    getBounds,
    fitDistricts(code, animate = true) {
      fitAreas(localAreas.get(code), animate)
    },
    fitDistrict(place, animate = true) {
      const area = areaById.get(place?.id)
      if (area) fitAreas([area], animate, canvas.parentElement?.querySelector('#detail'))
    },
    flyTo,
    reset,
    setZoom: (factor) => zoomAt(factor),
    panBy: (dx, dy) => {
      stopMotion()
      setCamera(cx + dx / scale(), cy + dy / scale(), zoom)
    },
    setLayers: (updates) => {
      Object.assign(layers, updates)
      queue()
    },
    setLens: (id, values = {}) => {
      lens = id
      lensColors = { ...values }
      for (const [key, color] of Object.entries(values)) lensColors[geoName(key)] = color
      queue()
    },
    selectPlace(place) {
      if (!place) {
        selected = null
        onSelect?.(null)
        queue()
        return
      }
      const point = project(place.lon, place.lat)
      selected = resultAt(...toScreen(...point), place)
      onSelect?.(selected)
      queue()
    },
    selectTile(lon, lat) {
      selected = resultAt(...toScreen(...project(lon, lat)), null, true)
      onSelect?.(selected)
      queue()
    },
    clearSelection() {
      selected = null
      queue()
    },
    highlightArea(rings = []) {
      highlight = rings.length ? pathFromLines(rings, true) : null
      queue()
    },
    destroy() {
      disposed = true
      observer.disconnect()
      stopMotion()
      cancelAnimationFrame(frame)
      for (const [name, handler] of Object.entries(handlers)) canvas.removeEventListener(name, handler)
      canvas.style.touchAction = initialTouchAction
    }
  }
  onReady?.(api)
  return api
}
