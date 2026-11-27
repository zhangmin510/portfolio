# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely>=2,<3"]
# ///
"""Rebuild the county explorer from the Dong et al. public census tables."""
import argparse
import csv
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

from shapely import from_wkt
from shapely.geometry.polygon import orient

SITE = Path(__file__).resolve().parents[1]
REVISION = '0ba0f1efae092f4aa6569ef38e53b3bb4d2f0087'
BASE = f'https://raw.githubusercontent.com/leiii/census/{REVISION}'
INPUTS = {
    'counties.csv': 'data/census/census_county_2010-2020_v1.csv',
    'county2020.xlsx': 'data/census/census_county_2020_v1.xlsx',
    'county-license.txt': 'LICENSE',
}


def cache_inputs(cache, offline):
    cache.mkdir(parents=True, exist_ok=True)
    for name, remote in INPUTS.items():
        target = cache / name
        if target.exists():
            continue
        if offline:
            raise FileNotFoundError(target)
        partial = target.with_suffix('.part')
        subprocess.run(['curl', '-fsSL', '--retry', '3', '--max-time', '120',
                        f'{BASE}/{remote}', '-o', str(partial)], check=True)
        partial.replace(target)


def yearbook_records(book):
    with ZipFile(book) as zipped:
        strings = [''.join(item.itertext()) for item in ET.fromstring(zipped.read('xl/sharedStrings.xml'))]
        records, titles = {}, {}
        for _, row in ET.iterparse(zipped.open('xl/worksheets/sheet1.xml'), events=('end',)):
            if not row.tag.endswith('}row'):
                continue
            cells = {}
            for cell in row.findall('{*}c'):
                value = cell.findtext('{*}v')
                if value is not None:
                    column = re.sub(r'\d+', '', cell.attrib['r'])
                    cells[column] = strings[int(value)] if cell.get('t') == 's' else value
            if not titles:
                titles = cells
            else:
                record = {titles[col]: val for col, val in cells.items() if col in titles}
                records[record.get('区划代码')] = record
            row.clear()
    return records


def numeric(value):
    if value in ('', None, 'NA'):
        return None
    result = float(value)
    return int(result) if result.is_integer() else result


def county_geometry(wkt):
    geom = from_wkt(wkt)
    if not geom.is_valid:
        geom = geom.buffer(0)
    parts = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
    centre = max(parts, key=lambda p: p.area).representative_point()
    rings = []
    for polygon in parts:
        simple = orient(polygon.simplify(.012, preserve_topology=True), sign=1)
        for line in [simple.exterior, *simple.interiors]:
            ring = [[round(x, 4), round(y, 4)] for x, y in line.coords]
            if len({tuple(p) for p in ring}) >= 3:
                rings.append(ring)
    return round(centre.x, 4), round(centre.y, 4), rings


def assemble(cache):
    records = yearbook_records(cache / 'county2020.xlsx')
    items, shapes = [], []
    with (cache / 'counties.csv').open(encoding='utf-8-sig', newline='') as sheet:
        for row in csv.DictReader(sheet):
            if row['province_code'][:2] in ('71', '81', '82'):
                continue
            code = row['county_code']
            book = records.get(code, {})
            if book.get('区县') != row['county'] or book.get('省') != row['province']:
                book = {}
            pop = numeric(row['popu_2020'])
            yearbook_pop = numeric(book.get('人口数_合计'))
            source = '公报面板' if pop else '普查分县资料'
            if pop is None:
                pop = yearbook_pop
            if not pop:
                continue
            # Restrict extra indicators to a census table covering precisely the
            # same unit and population as the historical panel.
            if yearbook_pop != pop:
                book = {}
            base = numeric(row['popu_2010'])
            lon, lat, rings = county_geometry(row['coord'])
            urban_count = numeric(book.get('城镇人口'))
            item = dict(id=code, name=row['county'], province=row['province'], city=row['city'],
                        lon=lon, lat=lat, population=pop, population2010=base,
                        growth=round(100 * (pop / base - 1), 2) if base else None,
                        urban=round(100 * urban_count / pop, 2) if urban_count is not None else None,
                        schoolYears=numeric(book.get('平均受教育年限_合计')), source=source)
            for key, panel_key, book_key in (
                ('age65', 'age_65_2020', '人口比重_65岁及以上'),
                ('children', 'age_0_14_2020', '人口比重_0-14岁'),
                ('householdSize', 'household_2020', '户规模'),
            ):
                indicator = numeric(row[panel_key])
                item[key] = numeric(book.get(book_key)) if indicator is None else indicator
            assert rings and 70 < lon < 137 and 15 < lat < 55
            items.append(item)
            shapes.append(dict(id=code, rings=rings))
    return items, shapes


def write_json(name, data):
    target = SITE / 'data' / name
    target.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, required=True)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    cache_inputs(args.cache_dir, args.offline)
    items, shapes = assemble(args.cache_dir)
    assert len(items) == len({item['id'] for item in items}) == 2774
    assert len({item['province'] for item in items}) == 31
    assert sum(item['population2010'] is not None for item in items) == 2666
    assert sum(item['source'] == '普查分县资料' for item in items) == 106
    assert all(item['growth'] is None or item['growth'] >= -100 for item in items)
    for field in ('urban', 'age65', 'children'):
        assert all(item[field] is None or 0 <= item[field] <= 100 for item in items)
    data = SITE / 'data'
    data.mkdir(exist_ok=True)
    (data / 'county-license.txt').write_bytes((args.cache_dir / 'county-license.txt').read_bytes())
    write_json('counties.json', dict(year=2020, baseline=2010, sourceUrl='https://github.com/leiii/census',
               coverage='中国大陆31个省级地区的2774个县级统计单元，区划调整涉及的区县合并统计。2666个单元可比较2010与2020年。', items=items))
    write_json('county-shapes.json', dict(shapes=shapes))
    print(f'{len(items)} statistical units, {len(shapes)} shapes')
    for filename in INPUTS:
        print(filename, hashlib.sha256((args.cache_dir / filename).read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
