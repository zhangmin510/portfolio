# /// script
# requires-python = ">=3.10"
# dependencies = ["requests>=2.31", "xlrd>=2.0"]
# ///
"""Refresh mainland ETFs and indices from the exchanges and index providers."""

import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import io
import json
import re
import tempfile
from pathlib import Path
from urllib.parse import urlencode
from xml.etree import ElementTree
import zipfile

import xlrd

import build_cn as cn

CNI_NAMES = {
    "399264": "创业板软件指数",
    "399389": "国证通信指数",
    "970070": "创业板人工智能指数",
    "970083": "创业板算力基础设施指数",
    "980017": "国证半导体芯片指数",
    "980022": "国证机器人产业指数",
    "980030": "国证消费电子主题指数",
    "980034": "国证工业软件主题指数",
}
THEMES = [
    ("AI 软件与应用", r"人工智能.*应用|AI应用", "模型在软件和业务流程中的应用"),
    ("人工智能", r"人工智能|(?<![a-z])AI(?![a-z])", "AI 产业链上的相关上市公司"),
    ("算力基础设施", r"算力|智算", "计算设备、算力设施及其运营"),
    ("机器人", r"机器人", "机器人、控制系统及自动化配套企业"),
    ("半导体与芯片", r"芯片|集成电路|半导体", "芯片设计、制造、设备及材料等半导体业务"),
    ("云计算与数据", r"云计算|大数据|数据中心", "计算资源、云服务及数据处理基础设施"),
    ("通信与互连", r"通信|5G|光模块|PCB", "网络设备、通信服务或互连基础设施"),
    ("软件", r"软件", "软件产品与服务"),
    (
        "智能驾驶",
        r"智能汽车|智能车|智能电动汽车|智能驾驶|智能网联|车联网",
        "汽车电子、智能汽车或车联网应用",
    ),
    ("终端设备", r"消费电子|智能终端|智能硬件", "面向消费者的终端和电子元器件"),
]
DIRECT = {"人工智能", "AI 软件与应用", "算力基础设施", "机器人"}
CN_SEARCH = ("人工智能", "算力", "机器人", "大模型", "光通信", "智算")
SEARCH_URL = (
    "https://www.csindex.com.cn/csindex-home/index-list/search-result-about-index"
)


def match(name):
    name = re.sub(r"港股通|沪港通|深港通", " ", name)
    for theme, pat, description in THEMES:
        if re.search(pat, name, re.I):
            return theme, description
    return None


def listed_etfs():
    sh = []
    for kind in ("0", "1"):
        params = dict(
            sqlId="FUND_LIST",
            fundType="00",
            etfApType=kind,
            subClass="01,02,03,04,06,08,09,31,32,33,34,35,36,37,38",
            isPagination="true",
        )
        params.update({"pageHelp.pageSize": 3000, "pageHelp.pageNo": 1})
        batch = cn.json_cache(
            "ssf" + kind + ".json",
            lambda: cn.response(
                "https://query.sse.com.cn/commonSoaQuery.do",
                params=params,
                headers={"Referer": "https://www.sse.com.cn/assortment/fund/etf/list/"},
            ).json(),
        )
        assert len(batch["result"]) == int(batch["pageHelp"]["total"])
        sh.extend(batch["result"])
    records = [
        (
            r["fundCode"],
            r["secNameFull"],
            "SSE",
            r["INDEX_CODE"].strip().upper(),
            r["INDEX_NAME"].strip(),
            r["companyName"],
        )
        for r in sh
        if r.get("INDEX_CODE") and r.get("INDEX_NAME")
    ]
    sz = cn.cached(
        "inst0",
        lambda: (
            cn.response(
                "https://www.szse.cn/api/report/ShowReport",
                params=dict(SHOWTYPE="xlsx", CATALOGID=1945, TABKEY="tab1"),
            ).content
        ),
    )
    with zipfile.ZipFile(io.BytesIO(sz)) as book:
        tree = ElementTree.fromstring(book.read("xl/worksheets/sheet1.xml"))
        for row in tree.findall(".//{*}row")[1:]:
            code, name, index, _, provider = [
                "".join(c.itertext()).strip() for c in row
            ]
            if index:
                records.append(
                    (
                        code,
                        name,
                        "SZSE",
                        index.split()[0].upper(),
                        CNI_NAMES.get(index.split()[0], ""),
                        provider,
                    )
                )
    return records


def search_indexes():
    out = set()
    for word in CN_SEARCH:

        def get_results():
            return cn.response(
                SEARCH_URL, params={"searchInput": word, "pageNum": 1, "pageSize": 100}
            ).json()

        listing = cn.json_cache("find-" + word + ".json", get_results)
        assert listing["total"] == len(listing["data"])
        out.update(
            row["indexCode"]
            for row in listing["data"]
            if row["region"] in {"境内", "沪深港"} and row["assetsClassify"] == "股票"
        )
    return out


def index_entry(code, securities, hk_securities, source_ids):
    hk_members = set()
    if code in CNI_NAMES:
        name = CNI_NAMES[code]
        url = (
            "https://www.cnindex.com.cn/module/index-detail.html?act_menu=1&indexCode="
            + code
        )
        holdings_url = (
            "https://www.cnindex.com.cn/sample-detail/download-history?indexcode="
            + code
        )
        payload = cn.cached("cnih" + code, lambda: cn.response(holdings_url).content)
        with zipfile.ZipFile(io.BytesIO(payload)) as book:
            root = ElementTree.fromstring(book.read("xl/worksheets/sheet1.xml"))
            rows = [
                ["".join(c.itertext()).strip() for c in row]
                for row in root.findall(".//{*}row")[1:]
            ]
        date = max(r[0] for r in rows)
        members = {r[1] for r in rows if r[0] == date}
        count = len(members)
        provider = "深圳证券信息有限公司"
        candidate_source = "cn-cni-" + code
    else:
        url = "https://www.csindex.com.cn/#/indices/family/detail?indexCode=" + code
        meta_url = (
            "https://www.csindex.com.cn/csindex-home/indexInfo/index-basic-info/" + code
        )
        info = cn.json_cache(
            "index-base-" + code, lambda: cn.response(meta_url).json()
        )["data"]
        name = info["indexFullNameCn"]
        holdings_url = cn.CSI.format(code)
        payload = cn.cached(
            "index-hold-" + code, lambda: cn.response(holdings_url).content
        )
        sheet = xlrd.open_workbook(file_contents=payload).sheet_by_index(0)
        rows = [sheet.row_values(i) for i in range(1, sheet.nrows)]
        dates = {str(r[0]) for r in rows}
        assert len(dates) == 1
        date = next(iter(dates))
        date = f"{date[:4]}-{date[4:6]}-{date[6:]}"
        members = {
            r[4]
            for r in rows
            if r[7]
            in {
                "上海证券交易所",
                "深圳证券交易所",
                "北京证券交易所",
                "Shanghai",
                "Shenzhen",
                "Beijing",
            }
        }
        for entry in rows:
            if entry[7] in {"香港证券交易所", "Hong Kong", "HKEX"}:
                number = re.fullmatch(r"(\d{1,5})(?:\.HK)?", str(entry[4]), re.I)
                if number:
                    hk_members.add(number[1].zfill(5))
        count = len(rows)
        provider = (
            "中华证券交易服务有限公司（委托中证指数编制）"
            if code == "990001"
            else "中证指数有限公司"
        )
        candidate_source = "cn-csi-" + code
    category, description = match(name)
    matched = sorted(members & securities)
    assert date <= cn.DATE and count >= len(matched)
    sentence = (
        "指数观察" + description + "。"
        if category in DIRECT
        else "这是产业链配套指数，样本范围包含"
        + description
        + "以及面向其他行业的业务。"
    )
    scope = (
        "沪深港"
        if ("沪深港" in name or "沪港深" in name)
        else ("中国内地与韩国" if "中韩" in name else "中国内地")
    )
    detail = f"{sentence}覆盖市场为{scope}。成分表日期为 {date}，完整样本 {count} 只。"
    out = dict(
        type="index",
        market="CN",
        code=code,
        name=name,
        provider=provider,
        venue="指数",
        theme=category,
        detail=detail,
        url=url,
        asOf=date,
        holdingsUrl=holdings_url,
        holdingsAsOf=date,
        membershipBasis="index",
        sourceMemberCount=count,
        memberTickers=matched,
    )
    if hk_members:
        out["memberListings"] = [
            "HK-" + ticker for ticker in sorted(hk_members & hk_securities)
        ]
    if candidate_source in source_ids:
        out["memberSources"] = [candidate_source]
    return out


def main():
    dataset = json.loads((cn.ROOT / "data" / "cn.json").read_text())
    securities = {r["ticker"] for r in dataset["companies"]}
    source_ids = {r["id"] for r in dataset["sources"]}
    hk = json.loads((cn.ROOT / "data" / "hk.json").read_text())
    pairs = json.loads((cn.ROOT / "data" / "cross-listings.json").read_text())
    hk_securities = {r["ticker"] for r in hk["companies"]} | {
        r["hkTicker"] for r in pairs
    }
    funds = listed_etfs()
    index_codes = search_indexes()
    for _, name, _, index, benchmark, _ in funds:
        if match(name) or match(benchmark):
            index_codes.add(index)
    # Benchmarks may have multiple listings with different trading abbreviations.
    selected = [row for row in funds if row[3] in index_codes]
    with ThreadPoolExecutor(max_workers=6) as pool:
        indices = {
            r["code"]: r
            for r in pool.map(
                lambda c: index_entry(c, securities, hk_securities, source_ids),
                sorted(index_codes),
            )
        }
    fund_rows = []
    related = defaultdict(list)
    for code, name, venue, index, _, provider in selected:
        ref = indices[index]
        if venue == "SSE":
            url = (
                "https://www.sse.com.cn/assortment/fund/list/etfinfo/basic/index.shtml?FUNDID="
                + code
            )
        else:
            url = "https://www.szse.cn/disclosure/fund/etf/index.html?" + urlencode(
                dict(stock=code, name=name)
            )
        text = f"在{'上海' if venue == 'SSE' else '深圳'}证券交易所上市，跟踪{ref['name']}（{index}）。下方公司按 {ref['holdingsAsOf']} 的指数成分匹配。"
        if ref["theme"] not in DIRECT:
            text += "该行业基准同时覆盖面向其他应用的业务。"
        row = dict(
            type="etf",
            market="CN",
            code=code,
            name=name,
            venue=venue,
            provider=provider,
            theme=ref["theme"],
            detail=text,
            url=url,
            asOf=cn.DATE,
            benchmark=ref["name"],
            related=[index],
        )
        for key in [
            "holdingsUrl",
            "holdingsAsOf",
            "membershipBasis",
            "sourceMemberCount",
            "memberSources",
            "memberTickers",
            "memberListings",
        ]:
            if key in ref:
                row[key] = ref[key]
        fund_rows.append(row)
        related[index].append(code)
    for index, tickers in related.items():
        indices[index]["related"] = sorted(tickers)
    assert len({r["code"] for r in fund_rows}) == len(fund_rows)
    rows = sorted(fund_rows, key=lambda r: r["code"]) + list(indices.values())
    (cn.ROOT / "data" / "cn-instruments.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=1) + "\n"
    )
    print(len(fund_rows), "ETFs;", len(indices), "indices")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temporary:
        cn.CACHE = args.cache or Path(temporary)
        cn.CACHE.mkdir(exist_ok=True, parents=True)
        main()
