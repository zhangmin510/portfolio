"""Rebuild the 2024 atlas statistics from the checked source transcriptions."""
import csv
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
BASE = 'https://www.stats.gov.cn/sj/ndsj/2025/html/'
GRAIN = 'https://www.stats.gov.cn/sj/zxfb/202412/t20241213_1957744.html'
META = [
    ('gdp', '地区生产总值', '亿元人民币', '经济', 'C03-09', '按当年价格计算的地区生产总值。'),
    ('gdpPerCapita', '人均地区生产总值', '元/人', '经济', '按当年价格计算的地区生产总值除以年平均常住人口。'),
    ('gdpGrowth', '地区生产总值增速', '%', '经济', '按不变价格计算，以表中上年为 100 的生产总值指数减 100。'),
    ('primary', '第一产业增加值', '亿元', '经济', '第一产业按当年价格计算的增加值。'),
    ('secondary', '第二产业增加值', '亿元', '经济', '第二产业按当年价格计算的增加值。'),
    ('tertiary', '第三产业增加值', '亿元', '经济', '第三产业按当年价格计算的增加值。'),
    ('population', '年末人口', '万人', '人口', 'C02-07', '大陆为年末常住人口，香港和澳门采用各自年底人口估计，台湾为年底户籍登记人口。'),
    ('urban', '常住人口城镇化率', '%', '人口', '年末城镇人口占常住人口的比重。'),
    ('birthRate', '出生率', '‰', '人口', '每千人中的全年出生人数。'),
    ('deathRate', '死亡率', '‰', '人口', '每千人中的全年死亡人数。'),
    ('naturalGrowth', '人口自然增长率', '‰', '人口', '出生率与死亡率之差，负值表示死亡人数多于出生人数。'),
    ('income', '人均可支配收入', '元/人', '民生', 'C06-18', '全年全体居民人均可支配收入。'),
    ('jobs', '就业人员', '万人', '就业', 'C04-03', '2024 年底就业人员总数。'),
    ('farmJobs', '第一产业就业', '万人', '就业', '2024 年底第一产业就业人员。'),
    ('industrialJobs', '第二产业就业', '万人', '就业', '2024 年底第二产业就业人员。'),
    ('serviceJobs', '第三产业就业', '万人', '就业', '2024 年底第三产业就业人员。'),
    ('grain', '粮食总产量', '万吨', '农业', GRAIN, '全年的粮食总产量，包括谷物、豆类和薯类。'),
    ('grainArea', '粮食播种面积', '千公顷', '农业', '全年粮食作物的实际播种面积。'),
    ('grainYield', '粮食单位面积产量', '公斤/公顷', '农业', '粮食总产量除以粮食播种面积。使用公告发布的单位面积产量。'),
    ('patents', '专利授权数', '件', '创新', 'C20-20', '国内发明、实用新型和外观设计三种专利合计授权数，按申请人所属地区统计。'),
    ('electricity', '全社会用电量', '亿千瓦时', '能源', 'C09-14', '各地区全年用电量，取 2024 年列。'),
    ('railLength', '铁路营业里程', '公里', '交通', 'C16-03', '年末办理客货运输营业的铁路线路长度。'),
    ('expressway', '高速公路里程', '公里', '交通', '年末公路里程中高速公路的长度。'),
    ('freight', '货运量', '万吨', '交通', 'C16-13', '表内地区货运量合计。全国表另列有不分地区项。'),
    ('universities', '普通、职业高等学校数', '所', '教育', 'C21-15', '表内普通、职业高等学校的学校数。'),
    ('forestCover', '森林覆盖率', '%', '自然资源', 'C08-21', '第九次全国森林资源清查（2014—2018 年）森林面积占地区土地面积的比重。'),
    ('inventions', '发明专利授权数', '件', '创新', 'C20-20', '三种专利授权数中的发明专利授权数。'),
]


def read_rows(filename, index):
    result = {}
    with (SITE / 'source-statistics' / filename).open() as source:
        for row in csv.DictReader(source):
            name = row.pop(index)
            assert name not in result
            result[name] = {k: float(v) if '.' in v else int(v) for k, v in row.items() if v}
    return result


def build():
    metrics = []
    source = None
    for key, name, unit, group, *details in META:
        if len(details) == 2:
            ref = details[0]
            source = ref if ref.startswith('https:') else BASE + ref + '.jpg'
        metrics.append(dict(id=key, name=name, unit=unit, group=group, source=source, year='2014—2018' if key == 'forestCover' else 2024, description=details[-1]))
    regions = read_rows('regions-2024.csv', 'region')
    for area, extra in read_rows('transport-resources-education.csv', 'region').items():
        regions[area].update(extra)
    climate = read_rows('city-weather-2024.csv', 'city')
    assert len(regions) == 34 and len(climate) == 34
    for area, data in regions.items():
        if area in ['香港', '澳门', '台湾']:
            assert set(data) == {'patents', 'inventions'}
            continue
        assert set(data) == {metric['id'] for metric in metrics}
        assert abs(data['primary'] + data['secondary'] + data['tertiary'] - data['gdp']) < .21
        assert abs(data['jobs'] - sum(data[k] for k in ['farmJobs','industrialJobs','serviceJobs'])) <= 2
        assert abs(data['birthRate'] - data['deathRate'] - data['naturalGrowth']) < .011
        assert 0 < data['inventions'] <= data['patents']
        assert 0 < data['urban'] < 100 and -10 < data['gdpGrowth'] < 15
        assert abs(data['grainArea'] * data['grainYield'] / 10000 - data['grain']) < 1
    assert sum(d.get('universities', 0) for d in regions.values()) == 2870
    assert abs(sum(d.get('expressway', 0) for d in regions.values()) - 190678) <= 5
    assert all(-10 < v['temperature'] < 30 and 100 < v['precipitation'] < 4000 for v in climate.values())
    # Retain the original series and units alongside the two comparable display values.
    population = json.loads((SITE / 'data/tw-localities.json').read_text())
    gdp = json.loads((SITE / 'source-taiwan/gdp.json').read_text())
    grain = json.loads((SITE / 'source-taiwan/grain.json').read_text())
    assert population['year'] == grain['year'] == gdp['year'] == 2024
    localities = {r['code'] for r in population['localities']}
    assert len(localities) == 22 and localities == {r['code'] for r in grain['counties']}
    people = population['totals']['population']
    assert sum(r['population'] for r in population['localities']) == people
    assert round(gdp['gdpTwdMillion'] / gdp['twdPerCny'] / 100, 1) == gdp['gdp']
    regions['台湾'].update(population=people / 10000, gdp=gdp['gdp'])
    taiwan = dict(gdp=gdp, population=people, cerealsT=grain['total']['cerealsT'],
                  paddyT=grain['total']['paddyT'], populationSource=population['source'],
                  cerealsSource=grain['sources']['cereals'], paddySource=grain['sources']['crops'])
    for key, name, count in [('hk', '香港', 18), ('mo', '澳门', 23)]:
        dataset = json.loads((SITE / 'source-hkmo' / key / 'dataset.json').read_text())
        regional = dataset['region']
        assert regional['year'] == 2024 and regional['name'] == name
        assert len({p['code'] for p in dataset['districts']}) == count
        assert regional['population'] > 0 and regional['gdpMillion'] > 0 and regional['currencyPerCny'] > 0
        comparable = round(regional['gdpMillion'] / regional['currencyPerCny'] / 100, 1)
        regions[name].update(population=regional['population'] / 10000, gdp=comparable)
    return dict(year=2024, regions=regions, taiwan=taiwan, metrics=metrics, climate=climate, climateSources={
        'temperature': BASE + 'C08-04.jpg', 'precipitation': BASE + 'C08-06.jpg'})


if __name__ == '__main__':
    (SITE / 'statistics.json').write_text(json.dumps(build(), ensure_ascii=False, separators=(',', ':')) + '\n')
