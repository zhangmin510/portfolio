import {copyFile, mkdir} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const source = dirname(fileURLToPath(import.meta.url))
const destination = resolve(source, '../../public/china-civ')
const assets = [
  'index.html', 'style.css', 'app.js', 'map.js', 'ui.js', 'almanac.js', 'explorer.js', 'compass.svg',
  'places.json', 'statistics.json', 'city-indicators.json', 'campus.json', 'air-traffic.json',
  'data/geography.json', 'data/relief.png', 'data/counties.json', 'data/county-shapes.json', 'data/county-license.txt',
  'TERRAIN.md', 'COUNTIES.md', 'CAMPUS.md', 'source-air-traffic/README.md', 'source-statistics/README.md', 'source-places/README.md',
]
for (const asset of assets) {
  const target = resolve(destination, asset)
  await mkdir(dirname(target), {recursive: true})
  await copyFile(resolve(source, asset), target)
}
console.log('China Civ: prepared '+assets.length+' offline assets')
