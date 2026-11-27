"""Rebuild Taiwan county/city household-registration statistics and map labels.

The default build uses the bundled small source extracts and Python's stdlib only.
--pages imports RIS API response JSON files; --geometry additionally needs pyshp and Shapely.
"""
import argparse
import csv
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
STAT_SOURCE = 'https://data.gov.tw/dataset/32973'
CHECK_SOURCE = 'https://www.ris.gov.tw/info-liferay/app/channel/newsDetail/25010858'
GEOMETRY_SOURCE = 'https://data.gov.tw/dataset/7442'
ARCHIVE_URL = 'https://maps.nlsc.gov.tw/download/' + quote('縣市界線(TWD97經緯度).zip')
API = 'https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/11312'
LICENSE = 'https://data.gov.tw/license'
COUNTS = {'population':23400220, 'male':11526193, 'female':11874027, 'households':9487480,
          'age0to14':2742386, 'age15to64':16169127, 'age65plus':4488707}
FIELDS = list(COUNTS)
SIMPLE = str.maketrans('縣臺東義門蘭蓮連園雲', '县台东义门兰莲连园云')
GEOMETRY_SHA = '0c6fca34a92b92ef3e9a41957e403cb89e814bb64942ca7c7e51c746f913d49d'


def save_villages(paths):
    ages = [f'{a:03}' for a in range(100)] + ['100up']
    seen = set()
    pages = set()
    villages = []
    for path in paths:
        page = json.loads(path.read_text())
        assert page['responseCode'] == 'OD-0101-S' and int(page['totalDataSize']) == 7748
        assert int(page['totalPage']) == 4 and page['page'] not in pages
        pages.add(page['page'])
        for record in page['responseData']:
            assert record['statistic_yyymm'] == '11312'
            village = record['district_code']
            assert village not in seen and len(village) == 11
            seen.add(village)
            age_counts = [sum(int(record[f'people_age_{a}_{s}']) for s in ('m','f')) for a in ages]
            people = int(record['people_total'])
            male, female = (int(record[f'people_total_{s}']) for s in ('m','f'))
            assert sum(age_counts) == people == male + female
            villages.append([village,record['site_id'][:3],people,male,female,int(record['household_no']),
                             sum(age_counts[:15]),sum(age_counts[15:65]),sum(age_counts[65:])])
    assert len(seen) == 7748 and pages == {'1','2','3','4'}
    # Retain the numbers used for the aggregation, not the 202 original single-age columns.
    import io
    stream = io.StringIO()
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['villageCode','officialName'] + FIELDS)
    writer.writerows(sorted(villages))
    (HERE / 'villages-202412.csv.gz').write_bytes(gzip.compress(stream.getvalue().encode(),mtime=0))


def rings_for(geom):
    parts = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
    rings=[]
    for polygon in parts:
        for ring in [polygon.exterior,*polygon.interiors]:
            points = [[round(x,6),round(y,6)] for x,y in ring.coords]
            if len(set(map(tuple,points))) >= 3:
                rings.append(points)
    return rings


def save_geometry(path):
    import shapefile
    from shapely.geometry import shape
    assert hashlib.sha256(path.read_bytes()).hexdigest() == GEOMETRY_SHA, 'Unexpected NLSC revision'
    geometry = {}
    for rec in shapefile.Reader(str(path)).iterShapeRecords():
        geom = shape(rec.shape.__geo_interface__)
        assert geom.is_valid
        largest = max(geom.geoms,key=lambda g:g.area) if geom.geom_type=='MultiPolygon' else geom
        loc = largest.representative_point()
        simplified = geom.simplify(.0015,preserve_topology=True)
        assert simplified.covers(loc)
        geometry[rec.record['COUNTYCODE']] = {
            'officialName':rec.record['COUNTYNAME'], 'en':rec.record['COUNTYENG'],
            'lon':round(loc.x,6),'lat':round(loc.y,6),'rings':rings_for(simplified)}
    assert len(geometry) == 22
    data=json.dumps(geometry,ensure_ascii=False,separators=(',',':'),sort_keys=True).encode()
    (HERE/'county-map-extract.json.gz').write_bytes(gzip.compress(data,mtime=0))


def build():
    with gzip.open(HERE/'villages-202412.csv.gz','rt',encoding='utf8') as f:
        grouped = {}
        names = {}
        villages=set()
        for row in csv.DictReader(f):
            v = row['villageCode']
            assert v not in villages
            villages.add(v)
            code = v[:5]
            counts=grouped.setdefault(code,Counter())
            for k in FIELDS:
                counts[k]+=int(row[k])
            assert names.setdefault(code,row['officialName'])==row['officialName']
    shapes=json.loads(gzip.decompress((HERE/'county-map-extract.json.gz').read_bytes()))
    assert len(villages) == 7748 and len(grouped) == 22 and set(shapes) == set(grouped)
    total=sum(grouped.values(),Counter())
    assert dict(total) == COUNTS
    localities=[]
    for code in sorted(grouped):
        shape=shapes[code]
        name=names[code].translate(SIMPLE)
        assert shape['officialName'] == names[code]
        aliases=[names[code],names[code].replace('臺','台'),name[:-1],names[code][:-1],shape['en']]
        level='直辖市' if code.startswith('6') else '县' if name.endswith('县') else '市'
        localities.append(dict(id='tw-'+code,code=code,kind='tw-locality',name=name,level=level,
                               aliases=list(dict.fromkeys(s for s in aliases if s!=name)),**grouped[code],**shape))
    out={'year':2024,'date':'2024-12-31','source':STAT_SOURCE,'scope':'2024 年 12 月底户籍登记人口。按户政原表县市汇总，包括金门、连江、澎湖。户数及年龄构成均采用户籍登记口径。',
         'geometryVersion':'内政部国土测绘中心 COUNTY_MOI_1090820（2020 年 8 月），区域内代表点与概化界线。',
         'villageCount':len(villages),'totals':dict(total),'localities':localities,
         'sources':[{'name':'内政部户政司 · 村里户数、单一年龄人口','url':STAT_SOURCE,'file':API,'license':'政府資料開放授權條款－第1版','licenseUrl':LICENSE},
                    {'name':'内政部户政司 · 2024 年 12 月户口统计资料分析','url':CHECK_SOURCE},
                    {'name':'内政部国土测绘中心 · 直辖市、县市界线','url':GEOMETRY_SOURCE,'file':ARCHIVE_URL,'license':'政府資料開放授權條款－第1版','licenseUrl':LICENSE}]}
    (HERE.parent.parent/'data/tw-localities.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages',nargs=4,type=Path,help='Four downloaded ODRP014/11312 pages')
    parser.add_argument('--geometry',type=Path,help='Original NLSC shapefile ZIP')
    args=parser.parse_args()
    if args.pages:
        save_villages(args.pages)
    if args.geometry:
        save_geometry(args.geometry)
    build()
