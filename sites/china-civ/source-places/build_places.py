"""Build site-root places.json. Run with --extract DIR to replace the GeoNames snapshot."""
import argparse
import csv
import gzip
import io
import json
import re
import shutil
import subprocess
import unicodedata
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
SNAPSHOT = HERE / "geonames-extract.json.gz"
CENSUS = "https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902003.html"
SOURCES = [
    {"name": "GeoNames 城市名录", "url": "https://www.geonames.org/", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/"},
    {"name": "UNESCO DataHub · World Heritage List", "url": "https://data.unesco.org/explore/dataset/whc001/", "license": "CC BY-SA 4.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/"},
    {"name": "国家统计局 · 第七次全国人口普查公报（第三号）", "url": CENSUS},
]
CAPITAL_IDS = {"1816670", "1819729", "1821274", "1668341"}
# International and local romanizations differ in these records.
DISPLAY_EN = {"1529102": "Ürümqi", "1280737": "Lhasa", "1821274": "Macao"}
# Short conventional city labels when a gazetteer localization includes a suffix or exonym.
LABELS = {"1529102": "乌鲁木齐", "2036892": "呼和浩特", "1280737": "拉萨",
          "1821274": "澳门", "1668341": "台北", "1819729": "香港"}
# Selected city geography is editorial. Describes location rather than a measured indicator.
NOTES = {
    "北京": "老城位于山前平原，向西可见太行山余脉，向北接燕山。",
    "天津": "海河穿过城区，在塘沽附近注入渤海。",
    "上海": "沿黄浦江向北可达吴淞口，河水在这里汇入长江。",
    "重庆": "嘉陵江在朝天门汇入长江，两江与山岭共同塑造城区。",
    "石家庄": "位于太行山东麓，由此向西进入山地，向东展开华北平原。",
    "太原": "汾河自北向南穿过太原盆地。",
    "呼和浩特": "坐落于大青山南麓的土默川平原。",
    "沈阳": "浑河流经城区，四周逐渐过渡到辽河平原。",
    "长春": "位于东北平原中部，伊通河流经城区。",
    "哈尔滨": "城区沿松花江两岸展开。",
    "南京": "长江自西南向东北穿城而过，紫金山位于老城东侧。",
    "杭州": "位于钱塘江北岸，西湖与西部丘陵紧邻老城。",
    "合肥": "南淝河穿城而过，汇入东南方的巢湖。",
    "福州": "位于闽江下游盆地，闽江向东流入海峡。",
    "南昌": "赣江穿城而过，继续向北汇入鄱阳湖。",
    "济南": "坐落在泰山北麓与黄河之间，地下水在老城一带涌出成泉。",
    "郑州": "位于黄河南岸，向西接山地，向东进入平原。",
    "武汉": "长江与汉江在城区交汇，将两江沿岸分为武昌、汉口、汉阳三镇。",
    "长沙": "湘江流经城区，橘子洲位于江心，岳麓山位于西岸。",
    "广州": "珠江穿过市区，向南通往珠江三角洲河网。",
    "深圳": "城市南邻香港，西临珠江口与伶仃洋。",
    "南宁": "邕江自西向东穿城，河流下游衔接郁江水系。",
    "海口": "位于海南岛北部，隔琼州海峡与雷州半岛相望。",
    "成都": "位于四川盆地西缘的成都平原，岷江水系分流其间。",
    "贵阳": "南明河穿过城区，周围为云贵高原的喀斯特山地。",
    "昆明": "坐落在滇池北部的高原盆地。",
    "拉萨": "位于雅鲁藏布江支流拉萨河的河谷中。",
    "西安": "坐落在关中平原，渭河在北、秦岭在南。",
    "兰州": "黄河沿狭长河谷穿城，两岸山地限制了城市的南北宽度。",
    "西宁": "位于青藏高原东北缘的湟水谷地。",
    "银川": "西靠贺兰山，东邻黄河，位于宁夏平原上。",
    "乌鲁木齐": "坐落在天山北麓，向北进入准噶尔盆地。",
    "香港": "维多利亚港位于香港岛和九龙半岛之间。",
    "澳门": "位于珠江口西岸，与珠海相邻。",
    "台北": "城区坐落在台北盆地，淡水河水系汇集于此。",
    "青岛": "老城位于胶州湾东岸，面向黄海。",
    "厦门": "厦门岛与海峡西岸大陆之间由海湾分隔。",
    "大连": "坐落在辽东半岛南端，向南隔海望山东半岛。",
    "桂林": "漓江穿过峰林遍布的喀斯特盆地。",
    "苏州": "位于太湖以东的平原河网，大运河穿过城区。",
}


def key(text):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub("[^a-z]", "", ascii_text.lower())


def read_rows(zipname, member):
    with ZipFile(zipname) as archive, archive.open(member) as raw:
        yield from csv.reader(io.TextIOWrapper(raw, encoding="utf8"), delimiter="\t", quoting=csv.QUOTE_NONE)


def region_is_multilingual(record):
    return record[8] in {"HK", "MO", "TW"} or record[10] in {"13", "14", "20"}


def extract(data_dir, uconv):
    cities = {
        r[0]: r for r in read_rows(data_dir / "cities15000.zip", "cities15000.txt")
        if r[8] in {"CN", "HK", "MO", "TW"} and r[6] == "P"
        and r[7] in {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPL"}
    }
    names = defaultdict(list)
    for country in ("CN", "HK", "MO", "TW"):
        for row in read_rows(data_dir / f"{country}.zip", f"{country}.txt"):
            _, gid, lang, label, preferred, _, colloquial, historic, *_ = row
            if gid in cities and lang.startswith("zh") and not (historic or colloquial) and re.fullmatch(r"[\u3400-\u9fff]{2,18}", label):
                names[gid].append([lang, label, preferred == "1"])

    han_names = sorted({label for group in names.values() for _, label, _ in group} | set(LABELS.values()))
    command = [uconv, "-x", "Traditional-Simplified; Han-Latin; Latin-ASCII"]
    roman = subprocess.run(command, input="\n".join(han_names), text=True, capture_output=True, check=True)
    pinyin = dict(zip(han_names, (key(s) for s in roman.stdout.splitlines())))
    simp = subprocess.run([uconv, "-x", "Traditional-Simplified"], input="\n".join(han_names),
                          text=True, capture_output=True, check=True)
    simplified = dict(zip(han_names, simp.stdout.splitlines()))
    records = []
    for gid, r in cities.items():
        candidates = names.get(gid, [])
        if not candidates and gid not in LABELS:
            continue
        targets = {key(r[1]), key(r[2])}
        def priority(alt):
            lang, label, preferred = alt
            return (pinyin[label] not in targets, not preferred,
                    lang not in ("zh", "zh-CN", "zh-Hans"), len(label))
        raw_label = LABELS[gid] if gid in LABELS else min(candidates, key=priority)[1]
        label = simplified.get(raw_label, raw_label)
        if len(label) > 2 and label.endswith("市"):
            label = label[:-1]
        english = DISPLAY_EN.get(gid, r[1])
        aliases = [r[2]]
        if region_is_multilingual(r) or gid in LABELS:
            aliases.append(pinyin.get(raw_label, ""))
        if label != raw_label:
            aliases.append(raw_label)
        aliases.extend(item[1] for item in candidates if simplified[item[1]].rstrip("市") == label and item[1] != label)
        region = r[10] if r[8] == "CN" else r[8]
        if gid == "13608003":  # Chongming, Shanghai; upstream admin1 is blank.
            region = "23"
        if not region:
            continue
        records.append([gid, region, label, english, sorted(set(aliases) - {label, english, ""}),
                        float(r[5]), float(r[4]), r[7], int(r[14] or 0)])
    with ZipFile(data_dir / "cities15000.zip") as z:
        year, month, day, *_ = z.getinfo("cities15000.txt").date_time
    payload = {"date": f"{year}-{month:02}-{day:02}", "rows": records}
    SNAPSHOT.write_bytes(gzip.compress(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))


def city_rank(gid, feature, pop):
    if gid == "1816670":
        return 0
    if feature == "PPLA" or gid in CAPITAL_IDS:
        return 1
    if feature == "PPLA2" or pop >= 1_000_000:
        return 2
    if feature == "PPLA3" or pop >= 150_000:
        return 3
    return 4


def landmarks():
    entries = json.loads(gzip.decompress((HERE / "unesco-extract.json.gz").read_bytes()))
    with (HERE / "heritage.tsv").open() as f:
        labels = {r["id"]: r for r in csv.DictReader(f, delimiter="\t")}
    assert set(labels) == {r["id_no"] for r in entries}
    types = {"Cultural": "文化遗产", "Natural": "自然遗产", "Mixed": "文化与自然双重遗产"}
    result = []
    for row in entries:
        whc = row["id_no"]
        label = labels[whc]
        components = row["components_list"]
        point = next(c for c in components if c["ref"] == label["ref"]) if label["ref"] else components[0]
        assert 73 < point["longitude"] < 136 and 18 < point["latitude"] < 54
        result.append(dict(kind="landmark", id="whc-" + whc, name=label["name"],
                           en=row["name_en"], province="CN-" + label["province"],
                           year=int(row["date_inscribed"]), type=types[row["category"]],
                           lon=round(point["longitude"], 5), lat=round(point["latitude"], 5),
                           description=label["description"], component=label["marker"] or label["name"],
                           components=len(components), link="https://whc.unesco.org/en/list/" + whc + "/"))
    return result


def build():
    with (HERE / "regions.tsv").open() as f:
        province_rows = list(csv.DictReader(f, delimiter="\t"))
    provinces = []
    region_ids = {p["code"]: p["id"] for p in province_rows}
    capitals = {}
    for row in province_rows:
        row.pop("code")
        row["lat"], row["lon"] = float(row["lat"]), float(row["lon"])
        if row["population"]:
            row["population"] = int(row["population"])
        else:
            row.pop("population")
        capitals[row["id"]] = row["capital"]
        provinces.append(row)
    snapshot = json.loads(gzip.decompress(SNAPSHOT.read_bytes()))
    cities = []
    for gid, region, name, en, aliases, lon, lat, feature, pop in snapshot["rows"]:
        province = region_ids[region]
        if (name, province) in {("吴忠", "CN-NX"), ("浦阳", "CN-ZJ")}:
            pop = 0  # Upstream values appear to refer to a different extent.
        rank = city_rank(gid, feature, pop)
        # Hong Kong has PPLA records for districts as well as the main urban anchor.
        if rank == 1 and name != capitals[province]:
            rank = 4 if province == "CN-HK" else 2
        city = dict(id=f"gn-{gid}", name=name, en=en, lon=lon, lat=lat, province=province, rank=rank)
        if aliases:
            city["aliases"] = aliases
        if pop:
            city["population"] = pop
        if name in NOTES and (capitals[province] == name or rank == 2):
            city["description"] = NOTES[name]
        cities.append(city)
    cities.sort(key=lambda c: (c["rank"], -c.get("population", 0), c["id"]))
    assert len(provinces) == 34 and len(region_ids) == 34
    assert len({c["id"] for c in cities}) == len(cities)
    for p in provinces:
        assert any(c["rank"] <= 1 and c["province"] == p["id"] and c["name"] == p["capital"] for c in cities), p
    result = {"snapshot": snapshot["date"], "provinces": provinces, "cities": cities, "landmarks": landmarks(), "sources": SOURCES}
    (HERE.parent / "places.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(cities)} city and settlement points, {len(provinces)} regions")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract", type=Path, help="folder containing cities15000.zip and CN/TW/HK/MO alternate-names ZIPs")
    parser.add_argument("--uconv", default=shutil.which("uconv"), help="ICU uconv executable (only for --extract)")
    args = parser.parse_args()
    if args.extract:
        if not args.uconv:
            parser.error("--extract requires ICU uconv")
        extract(args.extract, args.uconv)
    build()
