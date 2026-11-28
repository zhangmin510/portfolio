"""Build Macao's 2024 statistics and join the official statistical district map."""
import argparse
import csv
import gzip
import hashlib
import json
import re
import subprocess
import unicodedata
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.ops import polylabel

HERE = Path(__file__).resolve().parent
DSEC = "https://www.dsec.gov.mo"
POP = DSEC + "/getAttachment/3827c09a-ab7b-4c40-8aa1-8fee04195f8e/C_DEM_PUB_2024_Y.aspx"
GDP = DSEC + "/getAttachment/73F3560A-F9D1-492E-8660-EE31CB84E8D7/2025_11_14.aspx"
HOMES = DSEC + "/getAttachment/271a2006-126d-445b-a0d8-d6ac60accef4/2025.aspx"
EXCHANGE = "https://data.gov.mo/Detail?id=2cc3fd63-d857-48ce-82f6-35e5677713b9"
GIS = DSEC + "/CensusGIS/rest/services/Production2021/Census2021_Density23_TW_v2/MapServer/0"
PDF_HASH = {
    "pop": "c70a7bdc0b3aebe3bcd4c274ee91e02f7cece8e141fdbd72587011f2dc829cba",
    "gdp": "a357bedd68702dcbd4c04171b816d10dc8bbe79eb915e5d9acd2b3ca4849d7ac",
    "homes": "ab36cd912ce7cdb3b807d9dc1276e84c0bc135a449275adb365281f052a968d7",
}

def source_file(cache, filename, url):
    path = cache / filename
    if not path.exists():
        tmp = path.with_suffix(".part")
        subprocess.run(["curl", "-fsSL", "--retry", "2", "--max-time", "150", "-o", tmp, url], check=True)
        tmp.replace(path)
    return path

def pdf_text(cache, key, url):
    path = source_file(cache, key + ".pdf", url)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == PDF_HASH[key], f"Check revised PDF: {url}"
    data = subprocess.run(["pdftotext", "-layout", path, "-"], check=True, capture_output=True)
    return data.stdout.decode()

def people(text):
    table = text.split("6. 分區人口 (2024)")[1].split("\f")[0]
    assert "千人" in table and "End-year Total Population" in table
    rows = re.findall(r"^([\u3400-\u9fff()]+).*?\s+(\d+\.\d)\s+(\d+\.\d)\s*$", table, re.M)
    return {name: (int(Decimal(mid)*1000), int(Decimal(end)*1000)) for name, mid, end in rows}

def housing(text):
    table = text.split("2024年12月底按分區及實用面積統計的住宅單位及空置住宅單位數目")[1].split("\f")[0]
    result = {}
    for raw in table.splitlines():
        cols = re.split(r"\s{2,}", raw.strip())
        if len(cols) != 13 or not re.fullmatch(r"[\d ]+", cols[1]):
            continue
        name = unicodedata.normalize("NFKC", cols[0])
        if name == "路環":
            name = "路環區"
        values = [int(s.replace(" ", "")) if s != "-" else 0 for s in cols[1:]]
        assert sum(values[1:6]) == values[0] and sum(values[7:]) == values[6]
        result[name] = (values[0], values[6])
    return result

def gdp_amount(text):
    table = re.search(r"Million MOP\s+2017\s+2018\s+2019\s+2020\s+2021\s+2022\s+2023\s+2024\s+GDP\s+Before revision[^\n]+\s+After revision([^\n]+)", text)
    assert table, "Table 1, revised 2024 GDP at current prices"
    return int(re.split(r"\s{2,}", table[1].strip())[-1].replace(" ", ""))

def annual_fx(workbook):
    with (HERE / "exchange-2024.csv").open() as f:
        header, printed_row = csv.reader(f)
    if workbook:
        with ZipFile(workbook) as z:
            data = z.read("fxRatePeriodAverage.xlsx") if "fxRatePeriodAverage.xlsx" in z.namelist() else workbook.read_bytes()
        with ZipFile(BytesIO(data)) as z:
            rows = ET.fromstring(z.read("xl/worksheets/sheet1.xml")).findall(".//{*}row")
        values = [["".join(cell.itertext()) for cell in row] for row in rows]
        assert values[0] == header and [r for r in values if r[:2] == ["2024", "null"]] == [printed_row]
    return float(Decimal(printed_row[header.index("RMB")])/100)

def district_shapes(verify_geometry):
    with gzip.open(HERE / "census-gis.json.gz", "rb") as src:
        original = src.read()
    assert hashlib.sha256(original).hexdigest() == "a38e2c34fb7340722759583964400206fb29644d5e999680f39d2627e47ad258"
    query = dict(where="1=1", outFields="Zona,Desc_C,Desc_CN,Desc_P", returnGeometry="true", f="json")
    def records(raw):
        return {r["attributes"]["Zona"]: r for r in json.loads(raw)["features"]}
    native = records(original)
    if verify_geometry:
        fresh = subprocess.check_output(["curl", "-fsSL", "--retry", "2", "--max-time", "90", GIS + "/query?" + urlencode(query)])
        assert records(fresh) == native, "The live district boundaries changed; review this snapshot."
    assert set(native) == set(range(1, 24)) | {26}
    to_wgs84 = Transformer.from_crs("EPSG:8433", "EPSG:4326", always_xy=True)
    for code in range(1, 24):
        record = native[code]
        rings = record["geometry"]["rings"]
        assert rings and all(rings) and all(18500 < x < 26500 and 8500 < y < 21000 for ring in rings for x,y in ring)
        geom = Polygon()
        for ring in rings:
            p = Polygon(ring)
            if p.area > 1:
                geom = geom.symmetric_difference(p if p.is_valid else p.buffer(0))
        simplified = geom.simplify(3, preserve_topology=True)
        assert geom.is_valid and simplified.is_valid and abs(simplified.area/geom.area - 1) < 0.012
        polys = list(simplified.geoms) if simplified.geom_type == "MultiPolygon" else [simplified]
        anchor = polylabel(max(polys, key=lambda p: p.area), tolerance=1)
        def wgs(point):
            lon, lat = to_wgs84.transform(*point)
            assert 113.50 < lon < 113.64 and 22.09 < lat < 22.24
            return [round(lon, 6), round(lat, 6)]
        lon, lat = wgs(anchor.coords[0])
        assert geom.contains(anchor)
        result = [[wgs(point) for point in ring.coords] for p in polys for ring in (p.exterior, *p.interiors)]
        row = record["attributes"]
        yield dict(code=str(code).zfill(2), officialName=row["Desc_C"], name=row["Desc_CN"],
                   en=row["Desc_P"].strip(), lon=lon, lat=lat, rings=result)

def build(cache, workbook, verify_geometry):
    cache.mkdir(parents=True, exist_ok=True)
    population = people(pdf_text(cache, "pop", POP))
    homes = housing(pdf_text(cache, "homes", HOMES))
    gdp = gdp_amount(pdf_text(cache, "gdp", GDP))
    assert population["全澳"] == (687000,688300) and population["水域"] == (800,800)
    assert homes["總計"] == (245303,15078) and gdp == 397560
    rows = list(district_shapes(verify_geometry))
    for row in rows:
        name = row["officialName"]
        row["midPopulation"], row["population"] = population[name]
        row["homes"], row["vacantHomes"] = homes[name]
    for column, national in (("population",688300), ("midPopulation",687000)):
        # Source values are published in hundreds. Preserve each row.
        total = sum(row[column] for row in rows) + 800
        assert abs(total-national) <= 100
    assert sum(r["homes"] for r in rows) == 245303
    assert sum(r["vacantHomes"] for r in rows) == 15078
    region = dict(name="澳门", code="CN-MO", year=2024, population=population["全澳"][1],
                  populationNote="2024 年末总人口，包括常住人口及流动人口，含居澳的外地雇员和外地学生。统计局另列本地人口 568,700 人。",
                  populationSource=POP+"#page=34", gdpMillion=gdp, currency="澳门元",
                  gdpNote="2024 全年按当年价格计算的本地生产总值，采用统计暨普查局 2025 年 11 月主要修订后的数值。",
                  gdpSource=GDP+"#page=48", currencyPerCny=annual_fx(workbook), exchangeSource=EXCHANGE,
                  exchangeNote="澳门金融管理局 2024 年期内平均汇率，每 100 元人民币兑 111.534 澳门元。",
                  districtLabel="统计分区", districtYear=2024, districtSource=POP+"#page=34",
                  districtNote="2024 年末 23 个陆上统计分区合计 687,500 人，另有水域 800 人计入全澳总人口。人口取整至百人。大学及北安湾区含澳门大学横琴校区人口，路环区含路氹填海区人口。",
                  boundarySource=GIS,
                  boundaryNote="采用统计暨普查局 2021 人口普查统计分区界线展示 2024 年数据。大学及北安湾区图形显示氹仔部分。",
                  districtGdpNote="统计暨普查局的 GDP 表公布全澳总量及其组成，未列这些统计分区的 GDP。",
                  marinePopulation=800)
    metrics = [
        dict(id="population", name="年末人口", unit="人", source=POP+"#page=34", note="2024 年末分区总人口，原表精确至百人。"),
        dict(id="midPopulation", name="年中人口", unit="人", source=POP+"#page=34", note="2024 年中分区总人口，原表精确至百人。"),
        dict(id="homes", name="住宅单位", unit="个", source=HOMES+"#page=4", note="2024 年 12 月底楼宇及单位总档案登记的住宅单位数。"),
        dict(id="vacantHomes", name="空置住宅单位", unit="个", source=HOMES+"#page=4", note="2024 年 12 月底，含获发使用准照但未装电表、用电量极低或核实无人占用的住宅单位，装修中的单位除外。"),
    ]
    out = dict(region=region, metrics=metrics, districts=rows)
    (HERE / "dataset.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",",":"))+"\n")
    print(f"Built {len(rows)} districts, {sum(len(r) for d in rows for r in d['rings'])} map vertices")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--exchange-file", type=Path, help="Check the saved annual row against the official FX XLSX or its ZIP")
    parser.add_argument("--verify-geometry", action="store_true", help="Compare the native official GIS query to the saved snapshot")
    args = parser.parse_args()
    build(args.cache, args.exchange_file, args.verify_geometry)
