"""Rebuild the city-aggregated 2024 CAAC passenger-airport layer."""
import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
SOURCE = "https://www.caac.gov.cn/XXGK/XXGK/TJSJ/202503/t20250314_226932.html"
WORKBOOK = "https://www.caac.gov.cn/XXGK/XXGK/TJSJ/202503/P020250314353470214193.xlsx"
DIGEST = "aaea12704f7983d1e7aa378acadefd6036176a27ed0929caf3e6cca8f14357d1"
SNAPSHOT = HERE / "caac-2024-top50.csv"
COLUMNS = ["rank", "name", "passengers", "cargoTonnes"]
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def extract(path):
    assert hashlib.sha256(path.read_bytes()).hexdigest() == DIGEST, "Source revision differs"
    with ZipFile(path) as book:
        strings = ["".join(x.itertext()).strip() for x in ElementTree.fromstring(book.read("xl/sharedStrings.xml"))]
        sheet = ElementTree.fromstring(book.read("xl/worksheets/sheet1.xml")).find(NS + "sheetData")
    records = []
    total = None
    for row in sheet:
        cells = {}
        for cell in row:
            node = cell.find(NS + "v")
            if node is not None:
                column = re.sub(r"\d", "", cell.get("r"))
                cells[column] = strings[int(node.text)] if cell.get("t") == "s" else node.text
        if cells.get("A") == "合计":
            total = int(cells["C"])
        if cells.get("B", "").isdigit():
            records.append(dict(rank=int(cells["B"]), name=cells["A"], passengers=int(cells.get("C", 0)),
                                cargoTonnes=cells.get("G", "0")))
    assert sum(r["passengers"] for r in records) == total == 1_459_517_710
    picked = sorted((r for r in records if 1 <= r["rank"] <= 50), key=lambda r: r["rank"])
    assert len(picked) == 50 and [r["rank"] for r in picked] == list(range(1, 51))
    with SNAPSHOT.open("w", newline="") as f:
        writer = csv.DictWriter(f, COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(picked)


def build():
    lookup = defaultdict(list)
    for place in json.loads((HERE.parent / "places.json").read_text())["cities"]:
        lookup[place["name"]].append(place)
    cities, unmatched = {}, []
    with SNAPSHOT.open() as f:
        for row in csv.DictReader(f):
            city_name = row["name"].split("/")[0]
            candidates = lookup[city_name]
            # Disambiguate places with the same name in multiple provinces.
            province = {"长沙": "CN-HN", "海口": "CN-HI"}.get(city_name)
            if province:
                candidates = [c for c in candidates if c["province"] == province]
            airport = dict(name=row["name"], rank=int(row["rank"]), passengers=int(row["passengers"]),
                           cargoTonnes=float(row["cargoTonnes"]))
            if not candidates:
                assert city_name == "西双版纳"
                unmatched.append(dict(**airport, reason="原表为自治州名称，城镇名录无同名城市点。"))
                continue
            assert len(candidates) == 1, city_name
            city = cities.setdefault(candidates[0]["id"], {"passengers": 0, "cargoTonnes": 0, "airports": []})
            city["passengers"] += airport["passengers"]
            city["airports"].append(airport)
    for city in cities.values():
        city["cargoTonnes"] = float(sum(Decimal(str(a["cargoTonnes"])) for a in city["airports"]))
    assert len(cities) == 46 and len(unmatched) == 1
    result = {
        "year": 2024, "source": SOURCE, "workbook": WORKBOOK,
        "scope": "按民航局 2024 年境内民用运输机场旅客吞吐量取前 50 名，港澳台另行统计。图中 49 座机场按原表服务城市合并为 46 个点。西双版纳/嘎洒未匹配。旅客按人次、货邮按吨计。",
        "airportCount": 49, "sampleSize": 50, "cities": cities, "unmatched": unmatched,
    }
    (HERE.parent / "air-traffic.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", type=Path, help="Re-extract the pinned official CAAC workbook")
    args = parser.parse_args()
    if args.xlsx:
        extract(args.xlsx)
    build()
