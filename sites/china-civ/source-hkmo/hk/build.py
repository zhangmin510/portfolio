"""Build Hong Kong district statistics and chart geometry from official extracts (Shapely 2.x)."""
import argparse
import gzip
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlencode

from shapely.geometry import Point, shape
from shapely.ops import polylabel, unary_union

HERE = Path(__file__).resolve().parent
API = 'https://www.censtatd.gov.hk/api/get.php'
POP_PRESS = 'https://www.info.gov.hk/gia/general/202508/14/P2025081400404.htm'
GDP_TABLE = 'https://www.censtatd.gov.hk/tc/web_table.html?id=310-31001'
FX_TABLE = 'https://www.censtatd.gov.hk/tc/web_table.html?id=340-46001'
REPORT = 'https://www.censtatd.gov.hk/tc/wbr.html?ecode=B11303012024AN24'
GHS = 'censtatd_rcd_1635934545173_69201'
CENSUS = 'censtatd_rcd_1635932856094_19982'
CSDI = 'https://portal.csdi.gov.hk/server/rest/services/common/'
GHS_CATALOG = 'https://data.gov.hk/tc-data/dataset/hk-censtatd-census_geo-dc-ghs-csdi'
CONVERT = str.maketrans('區灣東離島九龍黃觀荃門貢', '区湾东离岛九龙黄观荃门贡')

# The original reporting units below also appear in the Census and Statistics Department's PDF tables.
FIELDS = [
    ('population', 't_lbnp', '陆上非住院人口', '人', '1–12 月住户调查及年中人口估计。人数公布至百人。'),
    ('households', 'dh', '家庭住户数', '户', '至少有一名常住居民的家庭住户。户数公布至百户。'),
    ('medianHouseholdIncome', 'ma_hh', '住户每月入息中位数', '港元', '包括所有家庭住户，以港元计。'),
    ('medianAge', 'lbnp_ma_t', '年龄中位数', '岁', '陆上非住院人口，含外籍家庭佣工。'),
    ('male', 'lbnp_m', '男性人口', '人', '陆上非住院人口。人数公布至百人。'),
    ('female', 'lbnp_f', '女性人口', '人', '陆上非住院人口。人数公布至百人。'),
    ('householdSize', 'adhz', '平均每户人数', '人/户', '家庭住户的平均成员人数。'),
    ('ownerOccupiedPct', 'dht_oopctn', '居于自置居所的住户比例', '%', '分母为该区所有家庭住户。'),
    ('labourForce', 't_lf', '劳动人口', '人', '十五岁及以上陆上非住院人口中的就业及失业人士。'),
]


def fetch(url):
    return subprocess.check_output(['curl', '-fsSL', '--retry', '2', '--max-time', '90', url])


def api_series(table, indicator, unit):
    url = API + '?' + urlencode(dict(id=table, lang='en', full_series=1))
    rows = json.loads(fetch(url))['dataSet']
    result, = [r for r in rows if r['period'] == '2024' and r['freq'] == 'Y'
               and r['sv'] == indicator and r['svDesc'] == unit]
    if table == '310-31001':
        quarters = [r['figure'] for r in rows if r['freq'] == 'Q' and r['period'].startswith('2024')
                    and r['sv'] == indicator and r['svDesc'] == unit]
        assert len(quarters) == 4 and sum(quarters) == result['figure']
    return result


def geo_query(service, where, fields, precision, tolerance):
    url = CSDI + service + '/MapServer/0/query?' + urlencode(dict(
        where=where, outFields=','.join(fields), outSR=4326, geometryPrecision=precision,
        maxAllowableOffset=tolerance, f='geojson'))
    return json.loads(fetch(url))['features']


def save_snapshot():
    html = fetch(POP_PRESS).decode()
    pop, = re.findall(r'revised figure for the year-end population for 2024 was ([\d ]+)\.', html)
    gdp = api_series('310-31001', 'CUR', 'HK$ million')
    fx = api_series('340-46001', 'FC_CNY', 'HK dollar per unit of foreign currency')
    # GDP and FX vintage and values are cited in the accompanying notes. Detect future revisions.
    assert gdp['figure'] == 3186526 and fx['figure'] == 1.0828
    districts = geo_query(GHS, 'year=2024', ['dc', 'dc_eng', 'dc_chi', 'year'] +
                          [f[1] for f in FIELDS], 6, 0.00015)
    land = geo_query(CENSUS, '1=1', ['dc', 'dc_eng', 'dc_chi'], 5, 0.00012)
    snapshot = dict(population=int(pop.replace(' ', '')), gdp=gdp, exchange=fx,
                    districts=districts, land=land)
    payload = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')).encode()
    (HERE / 'official-extracts.json.gz').write_bytes(gzip.compress(payload, mtime=0))


def polygon_parts(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == 'Polygon':
        return [geometry]
    if hasattr(geometry, 'geoms'):
        return [poly for part in geometry.geoms for poly in polygon_parts(part)]
    return []


def region_card(data):
    return dict(
        code='CN-HK', name='香港', year=2024, population=data['population'],
        populationNote='2024 年底香港居港人口修订数，含 7,219,900 名常住居民和 280,700 名流动居民。',
        populationSource='https://www.info.gov.hk/gia/general/202508/14/P2025081400405.htm',
        gdpMillion=data['gdp']['figure'], currency='港元',
        gdpNote='2024 年全年按当时市价计算的本地生产总值，取统计处表 310-31001 修订数（2026 年第三季版）。',
        gdpSource=GDP_TABLE, currencyPerCny=data['exchange']['figure'], exchangeSource=FX_TABLE,
        exchangeNote='2024 全年各交易日收市电汇中间价的平均数，单位为每元人民币兑港元。',
        districtLabel='区议会分区', districtYear=2024,
        districtNote='2024 年 1–12 月综合住户统计调查，以年中分区人口估计校准。陆上非住院人口涵盖陆上住户，剔除水上居民及院舍住院人士。该调查的全港估计为 7,432,500 人，与年底居港人口的时点和范围不同。',
        districtSource=REPORT, boundarySource=GHS_CATALOG,
        boundaryNote='2024 年统计处空间数据的十八区界，按 2021 年人口普查陆地轮廓裁切以显示岛屿与海港。标签位置在区内取点。',
        districtGdpNote='统计处的 GDP 表公布全港总量，2024 年分区统计表没有提供各区 GDP。',
    )


def build():
    data = json.loads(gzip.decompress((HERE / 'official-extracts.json.gz').read_bytes()))
    assert data['population'] == 7219900 + 280700
    assert data['gdp']['sd_value'] == 'r' and data['gdp']['svDesc'] == 'HK$ million'
    assert data['exchange']['sv'] == 'FC_CNY'
    land = unary_union([shape(f['geometry']).buffer(0) for f in data['land']])
    districts = []
    for feature in data['districts']:
        p = feature['properties']
        assert p['year'] == 2024
        geometry = shape(feature['geometry']).buffer(0).intersection(land)
        # This chart keeps parts down to about 1,100 m² and generalises outlines by ~25 metres.
        parts = [poly for poly in polygon_parts(geometry) if poly.area >= 1e-7]
        parts = sorted(parts, key=lambda g: -g.area)
        rings = []
        anchor_poly = None
        for part in parts:
            poly = part.simplify(0.00022, preserve_topology=True)
            for ring in (poly.exterior, *poly.interiors):
                points = [[round(x, 5), round(y, 5)] for x, y in ring.coords]
                if len(set(map(tuple, points))) >= 3:
                    rings.append(points)
            if anchor_poly is None:
                anchor_poly = poly
        point = polylabel(anchor_poly, tolerance=0.00015)
        lon, lat = round(point.x, 5), round(point.y, 5)
        assert geometry.contains(Point(lon, lat)) and len(rings) > 0
        name = p['dc_chi'].translate(CONVERT)
        district = dict(code=str(p['dc']), name=name, officialName=p['dc_chi'], en=p['dc_eng'],
                        aliases=list(dict.fromkeys([name[:-1], p['dc_chi'][:-1], p['dc_eng']])),
                        lon=lon, lat=lat, rings=rings)
        for key, field, *_ in FIELDS:
            value = p[field]
            assert isinstance(value, (int, float)) and value > 0
            district[key] = value
        districts.append(district)
    assert len({d['code'] for d in districts}) == len(districts) == 18
    # The published 18 district counts are rounded to hundreds. The aggregate PDF reports 7,432,500.
    assert sum(d['population'] for d in districts) == 7432700
    assert sum(d['households'] for d in districts) == 2763000
    metrics = [dict(id=key, name=name, unit=unit, note=note) for key, _, name, unit, note in FIELDS]
    output = dict(region=region_card(data), metrics=metrics, districts=districts)
    (HERE / 'dataset.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Fetch official observations and district boundaries first.')
    if parser.parse_args().refresh:
        save_snapshot()
    build()
