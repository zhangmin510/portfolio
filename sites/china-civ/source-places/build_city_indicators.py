"""Generate 2024 economic indicators as measured by NBS for 36 specified cities."""
import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = "https://www.stats.gov.cn/sj/ndsj/2025/html/C25-02.jpg"
FIELDS = [
    ("gdp", "地区生产总值", "亿元", "包括市辖县，当年价格。"),
    ("primary", "第一产业增加值", "亿元", "第一产业按当年价格计算的增加值。"),
    ("secondary", "第二产业增加值", "亿元", "第二产业按当年价格计算的增加值。"),
    ("tertiary", "第三产业增加值", "亿元", "第三产业按当年价格计算的增加值。"),
    ("budgetIncome", "一般公共预算收入", "亿元", "地方本级一般公共预算收入。"),
    ("budgetOutlay", "一般公共预算支出", "亿元", "地方一般公共预算支出。"),
    ("deposits", "住户存款余额", "亿元", "年末金融机构人民币各项存款余额中的住户存款。"),
    ("retail", "社会消费品零售总额", "亿元", "全市社会消费品零售总额。"),
    ("trade", "货物进出口总额", "亿元", "货物进口与出口金额合计。"),
    ("students", "普通、职业本专科在校学生", "人", "包括普通本科、职业本科和专科在校学生。"),
    ("hospitals", "医院", "个", "全市医院数。"),
    ("physicians", "执业（助理）医师", "人", "全市执业医师及执业助理医师人数。"),
]

def districts(v):
    tags = []
    for metric, boundary, name, title in [
        ("primary", 5, "农业区", "第一产业增加值占 GDP"),
        ("secondary", 40, "工业区", "第二产业增加值占 GDP"),
        ("tertiary", 70, "商业区", "第三产业增加值占 GDP"),
        ("trade", 50, "外贸区", "货物进出口总额与 GDP 之比"),
    ]:
        ratio = v[metric] / v["gdp"] * 100
        if ratio >= boundary:
            tags.append({"name": name, "reason": f"{title}为 {ratio:.1f}%，达到 {boundary}% 门槛。"})
    for metric, boundary, name, title, unit in [
        ("students", 500_000, "学院", "普通、职业本专科在校生", "人"),
        ("hospitals", 300, "医疗区", "医院", "个"),
    ]:
        if v[metric] >= boundary:
            tags.append({"name": name, "reason": f"{title} {v[metric]:,} {unit}，达到 {boundary:,} {unit}门槛。"})
    return tags


def build():
    places = json.loads((HERE.parent / "places.json").read_text())["cities"]
    payload = {"year": 2024, "source": SOURCE, "sourceName": "国家统计局《中国统计年鉴2025》表 25-2",
               "scope": "全市口径，包括市辖县。游戏标签由各项指标的展示阈值生成。",
               "metrics": [dict(id=id_, name=name, unit=unit, source=SOURCE, description=desc)
                           for id_, name, unit, desc in FIELDS], "cities": {}}
    with (HERE / "city-indicators.tsv").open() as f:
        for row in csv.DictReader(f, delimiter=" "):
            name = row.pop("name")
            matches = [p for p in places if p["rank"] <= 2 and p["name"] == name]
            assert len(matches) == 1, name
            values = {k: int(n) for k, n in row.items()}
            assert set(values) == {field[0] for field in FIELDS}
            assert abs(sum(values[k] for k in ["primary","secondary","tertiary"]) - values["gdp"]) <= 2
            values["districts"] = districts(values)
            payload["cities"][matches[0]["id"]] = values
    assert len(payload["cities"]) == 36
    (HERE.parent / "city-indicators.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    build()
