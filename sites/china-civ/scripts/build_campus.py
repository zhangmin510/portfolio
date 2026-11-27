# /// script
# requires-python = ">=3.10"
# dependencies = ["xlrd==2.0.2"]
# ///
"""Build the campus city index. The selection and attribution are documented in CAMPUS.md."""
import argparse
import html
import json
import re
import subprocess
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode, urlparse

import xlrd

SITE = Path(__file__).resolve().parents[1]
MOE = 'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html'
XLS = 'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/W020260618416094865984.xls'
DIRECTORY = 'https://hudong.moe.gov.cn/jyb_zzjg/moe_347/'
SCOPE = '2026 年教育部直属高校名录与全国普通高等学校名单的交集。按登记所在城市定位，同城高校共用城市坐标。'


def fetch(target, url, offline):
    if not target.exists():
        if offline:
            raise FileNotFoundError(target)
        partial = target.with_suffix('.part')
        subprocess.run(['curl', '-fsSL', '--retry', '2', '--max-time', '30', url, '-o', str(partial)], check=True)
        partial.replace(target)
    return target


def normalized(value):
    return unicodedata.normalize('NFKC', value).replace(' ', '')


def institution_records(cache, offline):
    directory = fetch(cache/'moe-affiliated.html', DIRECTORY, offline).read_text()
    links = {}
    for href, body in re.findall(r'''<dd>\s*<a\s+href=["']([^"']+)["'][^>]*>(.*?)</a>\s*</dd>''', directory, re.S|re.I):
        name = html.unescape(re.sub('<[^>]+>', '', body)).strip()
        links[normalized(name)] = html.unescape(href)
    book = xlrd.open_workbook(fetch(cache/'moe-universities-2026.xls', XLS, offline)).sheet_by_index(0)
    rows = []
    for i in range(book.nrows):
        _, name, code, ministry, city, level, private = book.row_values(i)
        if ministry == '教育部' and level == '本科' and not private and normalized(name) in links:
            rows.append(dict(name=name, code=str(int(code)), city=city, url=links[normalized(name)]))
    if len(rows) != 75:
        raise ValueError('The affiliated-school list has changed; review the input edition.')
    return rows


def ror_lookup(row, cache, offline):
    host = urlparse(row['url']).hostname.removeprefix('www.')
    queries = [('domain', {'query.advanced':'domains:'+host}),
               ('name', {'query':'"'+row['name']+'"', 'filter':'country.country_code:CN,types:education'})]
    for label, query in queries:
        path = cache / ('ror-'+label+'-'+row['code']+'.json')
        data = json.loads(fetch(path, 'https://api.ror.org/v2/organizations?'+urlencode(query), offline).read_text())
        if 'items' not in data:
            raise ValueError(f'Unexpected ROR reply for {row["name"]}')
        candidates = []
        for org in data['items']:
            if org['status'] != 'active' or 'education' not in org['types']:
                continue
            if not any(item['geonames_details']['country_code']=='CN' for item in org['locations']):
                continue
            domain_match = host in (org.get('domains') or []) or any(
                urlparse(link['value']).hostname in (host, 'www.'+host)
                for link in org['links'] if link['type']=='website')
            name_match = any(normalized(n['value']) == normalized(row['name']) for n in org['names'])
            if domain_match or name_match:
                candidates.append((domain_match, name_match, org))
        if len(candidates) == 1:
            _, _, org = candidates[0]
            name = next((n['value'] for n in org['names'] if n['lang']=='en' and 'ror_display' in n['types']), None)
            name = name or next((n['value'] for n in org['names'] if n['lang']=='en' and 'label' in n['types']), None)
            # Some English display labels, including Tongji University, omit a language tag.
            name = name or next((n['value'] for n in org['names'] if n['lang'] is None
                                and 'ror_display' in n['types'] and n['value'].endswith(' University')), None)
            return dict(en=name, ror=org['id'])
    return dict(en=None, ror=None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', required=True, type=Path)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    cache = args.cache_dir
    cache.mkdir(parents=True, exist_ok=True)
    records = institution_records(cache, args.offline)
    places = json.loads((SITE/'places.json').read_text())
    with ThreadPoolExecutor(max_workers=4) as pool:
        enrichment = list(pool.map(lambda row: ror_lookup(row, cache, args.offline), records))
    result = []
    # Match the provincial/prefecture seat in the gazetteer; zip-code or street
    # addresses would imply a level of precision the ministry list does not supply.
    for row, extra in zip(records, enrichment):
        cities = [c for c in places['cities'] if c['name'] == row['city'].removesuffix('市')]
        city = min(cities, key=lambda c:c['rank'])
        if sum(c['rank']==city['rank'] for c in cities) != 1:
            raise ValueError('Ambiguous gazetteer city: '+row['city'])
        result.append(dict(id='moe-'+row['code'], name=row['name'], **extra,
                           lon=city['lon'], lat=city['lat'], province=city['province'],
                           city=city['name'], cityId=city['id'], kind='campus', url=row['url'],
                           description='教育部直属普通本科高校。'+row['city']+'为名录登记所在地，标记使用城市代表点。'))
    data = dict(source=MOE, year=2026, scope=SCOPE, directory=DIRECTORY, items=result)
    (SITE/'campus.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n')
    print(len(result), 'universities;', len(set(i['cityId'] for i in result)), 'cities;',
          sum(bool(i['ror']) for i in result), 'ROR matches')


if __name__ == '__main__':
    main()
