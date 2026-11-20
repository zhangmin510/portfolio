# /// script
# requires-python = ">=3.10"
# dependencies = ["requests>=2.31", "xlrd>=2.0"]
# ///
"""Refresh the mainland snapshot with uv run scripts/build_cn.py. An optional
--cache directory reuses a single day's already retrieved inputs."""

import argparse
import csv
import io
import json
import re
import tempfile
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

import requests
import xlrd

ROOT = Path(__file__).resolve().parents[1]
API = "https://datacenter-web.eastmoney.com/api/data/v1/get"
CSI = "https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/cons/{}cons.xls"
SSE = "https://www.sse.com.cn/assortment/stock/list/share/"
SZSE = "https://www.szse.cn/market/product/stock/list/index.html"
BSE = "https://www.bse.cn/nq/listedcompany.html"
DATE = datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
# The first group is imported in full, subject to a current listing. Broader
# supplier groups can add a listing only if their own rationale names AI.
DIRECT = "AI芯片 高带宽内存 人形机器人 AI应用 AI智能体 AI语料 AI制药（医疗） AI眼镜 AI手机 AIPC AIGC概念 人工智能 智算中心（AIDC） 液冷服务器 算力租赁 算力概念 物理AI 多模态AI AI视频 机器视觉 MLOps概念 ChatGPT概念 DeepSeek概念 智谱AI概念 Kimi概念 华为昇腾".split()
RELATED = "光通信模块 CPO概念 铜缆高速连接 PCB 先进封装 存储芯片 半导体概念 EDA概念 光刻机 光刻胶 电网设备 其他电源设备Ⅱ 发电机概念 云计算 边缘计算 数据中心 机器人概念 机器人执行器 智能驾驶 英伟达概念 数据要素".split()
AI_TERMS = re.compile(
    r"人工智能|(?<![a-z])AI(?![a-z])|AIGC|AIDC|大模型|智算中心|训练芯片|推理芯片|智能算力|算力集群|生成式模型|具身智能|机器学习|深度学习|人形机器人",
    re.I,
)
GROUPS = {
    "chips": "AI芯片 高带宽内存 存储芯片 半导体概念 EDA概念 光刻机 光刻胶 先进封装",
    "infra": "光通信模块 CPO概念 铜缆高速连接 PCB 液冷服务器 其他电源设备Ⅱ 电网设备 发电机概念",
    "compute": "智算中心（AIDC） 算力租赁 算力概念 云计算 数据中心 华为昇腾 边缘计算",
    "robotics": "人形机器人 物理AI 机器人概念 机器人执行器 智能驾驶",
    "devices": "AI眼镜 AIPC AI手机",
    "services": "AI语料 数据要素 MLOps概念",
    "mixed": "人工智能 英伟达概念",
    "software": "AI制药（医疗） AI视频 AI智能体 AI应用 AIGC概念 多模态AI 机器视觉 DeepSeek概念 智谱AI概念 ChatGPT概念 Kimi概念",
}
SECTOR = {name: group for group, names in GROUPS.items() for name in names.split()}
LABEL = {
    "高带宽内存": "HBM",
    "物理AI": "物理AI",
    "智算中心（AIDC）": "智算中心",
    "其他电源设备Ⅱ": "电源设备",
    "AI制药（医疗）": "医疗AI",
    "AI语料": "训练数据",
    "AIPC": "AI PC",
    "AIGC概念": "生成式AI",
    "铜缆高速连接": "高速铜互连",
    "华为昇腾": "昇腾生态",
    "DeepSeek概念": "DeepSeek生态",
    "Kimi概念": "Kimi生态",
    "ChatGPT概念": "ChatGPT生态",
    "智谱AI概念": "智谱生态",
    "英伟达概念": "英伟达生态",
}
SOURCES = []


def add_source(i, kind, title, url, scope, date=DATE):
    SOURCES.append(dict(id=i, kind=kind, title=title, url=url, scope=scope, asOf=date))
    return i


def response(url, **opts):
    for attempt in range(3):
        try:
            result = requests.get(url, timeout=35, **opts)
            result.raise_for_status()
            return result
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def cached(name, read):
    file = CACHE / name
    if not file.exists():
        data = read()
        file.write_bytes(data)
    return file.read_bytes()


def json_cache(name, read):
    return json.loads(
        cached(name, lambda: json.dumps(read(), ensure_ascii=False).encode())
    )


def listings():
    active = {}
    sh_args = dict(
        isPagination="true",
        sqlId="COMMON_SSE_CP_GPJCTPZ_GPLB_GP_L",
        type="inParams",
        STOCK_TYPE="1,8",
        COMPANY_STATUS="2,4,5,7,8",
    )
    sh_args.update({"pageHelp.pageSize": 4000, "pageHelp.pageNo": 1})
    sh = json_cache(
        "list6",
        lambda: response(
            "https://query.sse.com.cn/sseQuery/commonQuery.do",
            params=sh_args,
            headers={"Referer": SSE},
        ).json(),
    )
    assert len(sh["result"]) == sh["pageHelp"]["total"]
    for row in sh["result"]:
        code = row["A_STOCK_CODE"]
        if re.fullmatch(r"(?:60\d{4}|688\d{3})", code):
            active[code + ".SH"] = row["SEC_NAME_CN"]
    sz = cached(
        "q0",
        lambda: (
            response(
                "https://www.szse.cn/api/report/ShowReport",
                params=dict(SHOWTYPE="xlsx", CATALOGID="1110", TABKEY="tab1"),
            ).content
        ),
    )
    with zipfile.ZipFile(io.BytesIO(sz)) as book:
        tree = ElementTree.fromstring(book.read("xl/worksheets/sheet1.xml"))
        for row in tree.findall(".//{*}row")[1:]:
            fields = {
                re.sub(r"\d+", "", cell.get("r")): "".join(cell.itertext())
                for cell in row
            }
            code = fields["E"].strip()
            if re.fullmatch(r"[03]\d{5}", code):
                active[code + ".SZ"] = fields["F"].strip()

    def bj(page):
        def read():
            data = response(
                "https://www.bse.cn/nqxxController/nqxxCnzq.do",
                params={
                    "page": page,
                    "typejb": "T",
                    "xxfcbj[]": "2",
                    "xxzqdm": "",
                    "sortfield": "xxzqdm",
                    "sorttype": "asc",
                },
                headers={"Referer": BSE},
            ).text
            return json.loads(data[data.index("[") : data.rindex("]") + 1])[0]

        return json_cache(f"bselist-{page}.json", read)

    first = bj(0)
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = first["content"] + [
            r
            for page in pool.map(bj, range(1, first["totalPages"]))
            for r in page["content"]
        ]
    assert len(set(r["xxzqdm"] for r in rows)) == first["totalElements"]
    for row in rows:
        active[row["xxzqdm"] + ".BJ"] = row["xxzqjc"]
    return active


def api_pages(query, cache_pattern):
    def page(i):
        return json_cache(
            cache_pattern.format(i),
            lambda: response(API, params=dict(query, pageNumber=i)).json()["result"],
        )

    first = page(1)
    with ThreadPoolExecutor(max_workers=4) as pool:
        data = first["data"] + [
            r
            for part in pool.map(page, range(2, first["pages"] + 1))
            for r in part["data"]
        ]
    assert len(data) == first["count"]
    return data


def theme(name):
    query = dict(
        reportName="RPT_F10_CORETHEME_BOARDTYPE",
        columns="ALL",
        pageSize=1000,
        filter=f'(BOARD_NAME="{name}")',
        sortColumns="SECUCODE",
        sortTypes="1",
    )

    def read():
        rows = api_pages(query, "theme-" + name + "-{}.json")
        return {"result": {"count": len(rows), "data": rows}}

    result = json_cache(name + ".json", read)["result"]
    rows = result["data"]
    assert len({r["SECUCODE"] for r in rows}) == result["count"]
    return name, rows


def constituent(index):
    book = xlrd.open_workbook(
        file_contents=cached(
            "csi" + index + ".xls", lambda: response(CSI.format(index)).content
        )
    ).sheet_by_index(0)
    rows = [book.row_values(i) for i in range(1, book.nrows)]
    assert len(set(r[4] for r in rows)) == len(rows)
    assert len(set(r[0] for r in rows)) == 1
    return rows


def source_url(code, report):
    cols = (
        "SECURITY_NAME_ABBR,BOARD_NAME,SELECTED_BOARD_REASON"
        if report == "CORETHEME_BOARDTYPE"
        else "ORG_NAME,MAIN_BUSINESS,BOARD_NAME_LEVEL"
    )
    return (
        API
        + "?"
        + urlencode(
            dict(
                reportName="RPT_F10_" + report,
                columns=cols,
                filter=f'(SECUCODE="{code}")',
                pageSize=250,
            )
        )
    )


def clean(name):
    return re.sub(r"\s+", "", name).strip()


def label(name):
    return LABEL.get(name, name.removesuffix("概念"))


def classifications(themes, industry):
    # For firms tagged across many themes, prefer classifications consistent
    # with the reported industry. Single-topic matches use that topic.
    preferences = []
    for pattern, sector in [
        (r"半导体|集成电路", "chips"),
        (r"通信设备|元件|电网设备|电源设备|制冷|温控", "infra"),
        (r"计算机设备|通信服务", "compute"),
        (r"机器人|自动化设备", "robotics"),
        (r"消费电子|汽车零部件|光学", "devices"),
        (r"软件|游戏|数字媒体|广告营销|医疗服务|出版", "software"),
    ]:
        if re.search(pattern, industry):
            preferences.append(sector)
    order = [n for n in list(SECTOR) if n in themes and SECTOR[n] in preferences] + [
        n for n in SECTOR if n in themes
    ]
    return [n for n in order if SECTOR[n] != "mixed"] + [
        n for n in order if SECTOR[n] == "mixed"
    ]


TERMS = "晶圆代工 晶圆制造 封装测试 先进封装 GPU ASIC HBM DRAM 存算一体 光模块 硅光 高速铜缆 PCB 覆铜板 服务器 液冷 冷板 供配电 不间断电源 UPS 变压器 智算中心 算力租赁 训练数据 数据标注 语音识别 大语言模型 世界模型 扩散模型 知识图谱 智能体 AI眼镜 无人驾驶 自动驾驶 人形机器人 灵巧手 减速器 机器视觉 语音交互 边缘计算 药物研发 辅助诊断 智慧医疗 教育 游戏 动画 工业质检 智能客服".split()


# Roles describe language in the selected item. Attribute the stage to the
# dated rationale because research plans and customer validation can change.
ROLES = [
    (
        r"参股|直接持有.{0,8}股权|间接持有.{0,8}股权|以基金.{0,12}投资|通过.{0,12}基金投资",
        "股权投资",
        "股权投资或参股企业",
    ),
    (
        r"尚未.{0,8}(?:量产|订单|销售|收入)|暂未.{0,8}(?:量产|订单|销售|收入)|小批量|送样|样品验证|样品.{0,6}验证|客户.{0,5}验证|试产|试制",
        "研发与验证",
        "送样、验证或商业化早期进展",
    ),
    (
        r"拟.{0,6}(?:投资|建设|设立|收购|筹建)|规划.{0,5}(?:建设|开发)|处于.{0,8}研发阶段|处于探索阶段|计划.{0,6}(?:开发|推出)",
        "规划与研发",
        "拟议项目或研发计划",
    ),
    (
        r"框架协议|战略合作协议|合作备忘录|联合实验室|签署.{0,8}合作|联合研发",
        "合作开发",
        "联合研发或合作协议",
    ),
    (
        r"批量.{0,5}(?:供货|交付|出货|供应)|实现.{0,4}量产|规模.{0,3}发货|已.{0,5}批量供|规模化应用|批量生产",
        "销售与交付",
        "量产、供货或规模应用",
    ),
    (
        r"适配|接入.{0,8}(?:模型|DeepSeek)|接入了.{0,8}(?:模型|DeepSeek)|完成对接|集成.{0,8}(?:模型|DeepSeek)",
        "接入与适配",
        "对现有模型或平台的接入适配",
    ),
    (
        r"公司.{0,7}(?:自研|自主研发)|公司.{0,6}自主开发|公司.{0,10}自行研发|公司搭建|公司推出|公司发布|公司开发了",
        "自研或发布",
        "自主研发或产品发布",
    ),
    (r"中标|采购合同|订单|签约", "项目与订单", "项目、订单或签约信息"),
    (r"供应商|配套|供货|提供.{0,12}零部件|向.{0,15}供应", "供应配套", "供应链配套"),
    (r"部署|引入|运用|应用于|落地应用|实际应用", "部署与应用", "部署或应用场景"),
    (r"研发|研制|开发", "技术开发", "技术研发"),
    (r"产品|解决方案|平台|服务", "产品与服务", "产品或服务"),
]


def describe_theme(theme_name, reason, industry):
    year = re.match(r"(20[0-9]{2})[年-]", reason)
    when = year[1] + " 年" if year else "该公司"
    if not reason:
        return f"东方财富将其纳入「{theme_name}」板块。" + (
            f"公司档案所列行业为{industry}。" if industry else ""
        ), "板块归属"
    contexts = [
        k
        for k in TERMS
        if re.search(re.escape(k), reason, re.I)
        and k.lower() not in label(theme_name).lower()
    ]
    role, phrase = next(
        ((role, phrase) for pat, role, phrase in ROLES if re.search(pat, reason, re.I)),
        ("板块归属", "相关业务线索"),
    )
    detail = f"「{theme_name}」板块引用的{when}资料涉及{phrase}"
    if contexts:
        detail += "，提及" + "、".join(contexts[:3])
    detail += "。"
    if industry:
        detail += f"公司档案所列行业为{industry}。"
    return detail, role


def fund_memberships(active):
    funds = [
        (
            "botz",
            "Global X BOTZ",
            "2026-11-19",
            "https://assets.globalxetfs.com/funds/holdings/botz_full-holdings_20261119.csv",
        ),
        (
            "humn",
            "Roundhill HUMN",
            "2026-11-20",
            "https://www.roundhillinvestments.com/assets/data/FilepointRoundhill.40RU.RU_Holdings_11192026.csv",
        ),
    ]
    by_code = {}
    for i, (slug, name, date, url) in enumerate(funds):
        text = cached("fund" + str(i) + ".csv", lambda: response(url).content).decode(
            "utf-8-sig"
        )
        source_rows = csv.DictReader(
            io.StringIO(text)
            if i == 1
            else io.StringIO("\n".join(text.splitlines()[2:]))
        )
        tickers = []
        for row in source_rows:
            if i == 1 and row.get("Account") != "HUMN":
                continue
            if i == 1:
                assert row["Date"] == "11/20/2026"
            matched = re.fullmatch(
                r"(\d{6}) (C1|C2)",
                (row.get("Ticker") or row.get("StockTicker") or "").strip(),
            )
            if matched:
                tickers.append(matched[1] + (".SH" if matched[2] == "C1" else ".SZ"))
        assert tickers and set(tickers) <= active.keys()
        sid = add_source(
            "cn-fund-" + slug,
            "fund",
            name + " · 机器人主题持仓",
            url,
            f"读取基金披露的全部持仓，按基金账户和沪深股票代码匹配到 {len(tickers)} 只 A 股。基金配置是主题性关联依据。",
            date,
        )
        for code in tickers:
            by_code.setdefault(code, []).append(sid)
    return by_code


def compile_data():
    active = listings()
    registry = {}
    for suffix, venue, url in [
        ("SH", "上海证券交易所", SSE),
        ("SZ", "深圳证券交易所", SZSE),
        ("BJ", "北京证券交易所", BSE),
    ]:
        count = sum(k.endswith("." + suffix) for k in active)
        registry[suffix] = add_source(
            "cn-list-" + suffix.lower(),
            "exchange",
            venue + " · 股票列表",
            url,
            f"本次名录中符合本地普通股代码规则的证券共 {count} 只，用于校验证券身份。",
        )
    query = dict(
        reportName="RPT_F10_BASIC_ORGINFO",
        columns="SECUCODE,SECURITY_CODE,ORG_NAME,ORG_NAME_EN,STR_CODEH,BOARD_NAME_LEVEL,TRADE_MARKET,SECURITY_TYPE,MAIN_BUSINESS",
        pageSize=500,
        sortColumns="SECUCODE",
        sortTypes="1",
        filter='(TRADE_MARKET in ("上海证券交易所","深圳证券交易所","北京证券交易所"))',
    )
    profiles = {
        r["SECUCODE"]: r
        for r in api_pages(query, "profiles-main-{}.json")
        if r["SECUCODE"] in active
    }
    primaries = {
        code
        for code, r in profiles.items()
        if AI_TERMS.search(r["MAIN_BUSINESS"] or "")
    }
    add_source(
        "cn-profiles",
        "other",
        "东方财富 F10 · 公司档案",
        API
        + "?"
        + urlencode(
            dict(
                reportName=query["reportName"],
                columns="SECUCODE,ORG_NAME,MAIN_BUSINESS,BOARD_NAME_LEVEL,STR_CODEH",
                pageSize=40,
            )
        ),
        f"以三地交易所 {len(active)} 只普通股为底表，匹配到 {len(profiles)} 份公司档案，在主营业务字段筛查 AI 相关术语。另用于行业、名称与 A/H 同一发行人代码核对。",
    )
    themes = {}
    records = {}
    candidates = set(primaries)
    with ThreadPoolExecutor(max_workers=5) as pool:
        for name, all_rows in pool.map(theme, DIRECT + RELATED):
            rows = [r for r in all_rows if r["SECUCODE"] in active]
            ident = all_rows[0]["NEW_BOARD_CODE"]
            direct = name in DIRECT
            matches = (
                rows
                if direct
                else [
                    r for r in rows if AI_TERMS.search(r["SELECTED_BOARD_REASON"] or "")
                ]
            )
            themes[name] = add_source(
                "cn-" + ident.lower(),
                "theme",
                "东方财富 · " + name,
                "https://data.eastmoney.com/bkzj/" + ident + ".html",
                f"F10 板块原表共 {len(all_rows)} 条，匹配当前普通股 {len(rows)} 只。"
                + (
                    "收录匹配的全部成员。"
                    if direct
                    else f"逐条检索，{len(matches)} 条入选说明出现 AI、大模型、机器学习、具身智能或智算等关键词。其余成员仅可补充已收录公司的产业标签。"
                ),
            )
            candidates.update(r["SECUCODE"] for r in matches)
            for r in rows:
                records.setdefault(r["SECUCODE"], {})[name] = r
    index_refs = {}
    index_labels = {}
    for index, name in [
        ("930713", "中证人工智能主题指数"),
        ("931071", "中证人工智能产业指数"),
        ("931441", "中证人工智能50指数"),
        ("931487", "中证沪港深人工智能50指数"),
        ("931688", "中证算力基础设施主题指数"),
        ("932359", "中证国新国企人工智能主题指数"),
        ("932383", "中证沪深港算力主题指数"),
        ("932438", "中证科创创业机器人指数"),
        ("932456", "中证科创创业人工智能指数"),
        ("932579", "中证科创创业人工智能应用臻选指数"),
        ("932610", "中证人工智能应用软件臻选指数"),
        ("932636", "中证人工智能应用臻选指数"),
        ("932644", "中证科创创业人工智能应用软件臻选指数"),
        ("932737", "中证中银沪深港人工智能产业指数"),
        ("950180", "上证科创板人工智能指数"),
        ("950398", "上证科创板人工智能应用臻选指数"),
        ("H30590", "中证机器人指数"),
    ]:
        rows = constituent(index)
        d = str(rows[0][0])
        date = f"{d[:4]}-{d[4:6]}-{d[6:]}"
        assert date <= DATE
        source = add_source(
            "cn-csi-" + index,
            "index",
            name + " · 完整成分表",
            CSI.format(index),
            f"指数代码 {index}，完整样本 {len(rows)} 只。",
            date,
        )
        for r in rows:
            suffix = {
                "上海证券交易所": ".SH",
                "深圳证券交易所": ".SZ",
                "北京证券交易所": ".BJ",
            }.get(r[7])
            if not suffix:
                continue
            code = r[4] + suffix
            if code in active:
                index_refs.setdefault(code, []).append(source)
                candidates.add(code)
                index_labels.setdefault(code, []).append(name)
    for index, name in [
        ("970070", "创业板人工智能指数"),
        ("970083", "创业板算力基础设施指数"),
        ("980022", "国证机器人产业指数"),
    ]:
        url = (
            "https://www.cnindex.com.cn/sample-detail/download-history?indexcode="
            + index
        )
        payload = cached("cnih" + index, lambda: response(url).content)
        with zipfile.ZipFile(io.BytesIO(payload)) as book:
            tree = ElementTree.fromstring(book.read("xl/worksheets/sheet1.xml"))
            rows = [
                ["".join(cell.itertext()).strip() for cell in row]
                for row in tree.findall(".//{*}row")[1:]
            ]
        latest = max(r[0] for r in rows)
        members = {r[1] for r in rows if r[0] == latest}
        source = add_source(
            "cn-cni-" + index,
            "index",
            name + " · 月末样本",
            url,
            f"当期样本 {len(members)} 只，取国证文件中最近一个完整报告日。",
            latest,
        )
        for code in active:
            if code[:6] in members:
                index_refs.setdefault(code, []).append(source)
                candidates.add(code)
                index_labels.setdefault(code, []).append(name)
    funds = fund_memberships(active)
    candidates.update(funds)
    board_notes = json.loads((ROOT / "scripts" / "cn_board_notes.json").read_text())
    featured = json.loads((ROOT / "scripts" / "cn_featured.json").read_text())
    for code in active:
        if code[:6] in featured:
            candidates.add(code)
    result = []
    for code in sorted(candidates):
        ticker, suffix = code.split(".")
        profile = profiles.get(code, {})
        name = clean(active[code])
        industry = (profile.get("BOARD_NAME_LEVEL") or "").split("-")[-1].rstrip("ⅠⅡⅢⅣ")
        matches = records.get(code, {})
        ordered = classifications(matches, industry)
        qualifying = [
            t
            for t in ordered
            if t in DIRECT or AI_TERMS.search(matches[t]["SELECTED_BOARD_REASON"] or "")
        ]
        first = next(iter(qualifying), None)
        sector = SECTOR.get(first, "mixed")
        tags = [label(n) for n in qualifying]
        sources = list(index_refs.get(code, [])) + list(funds.get(code, []))
        role = "主题收录"
        featured_row = featured.get(ticker)
        evidence_url = None
        if matches:
            evidence_url = source_url(code, "CORETHEME_BOARDTYPE")
        if featured_row:
            sector, segments, detail, title, url = featured_row
            id_ = add_source(
                "cn-co-" + ticker,
                "company",
                title,
                url,
                "支持本证券的公司业务描述。具体期间见文件标题。",
            )
            sources.insert(0, id_)
            tags = segments.split() + tags
            role = "公司披露"
        elif ticker in board_notes:
            sector, segment, role, detail = board_notes[ticker]
            tags.insert(0, segment)
        elif first:
            detail, role = describe_theme(
                first, matches[first]["SELECTED_BOARD_REASON"] or "", industry
            )
        elif code in index_labels:
            names = index_labels[code]
            joined = "、".join(names[:3])
            detail = (
                "指数发布方将公司列入"
                + joined
                + "的样本名单。"
                + (f"公司档案所列行业为{industry}。" if industry else "")
            )
            if any("机器人" in n for n in names):
                sector = "robotics"
                tags = ["机器人产业链"]
            elif any("算力" in n for n in names):
                sector = "compute"
                tags = ["算力基础设施"]
            elif any("应用" in n for n in names):
                sector = "software"
                tags = ["AI应用"]
            role = "专门指数样本"
        elif code in funds:
            sector = "robotics"
            tags = ["机器人产业链"]
            role = "主题基金持仓"
            detail = "机器人主题基金披露的投资组合持有该公司 A 股。" + (
                f"公司档案行业为{industry}。" if industry else ""
            )
        elif code in primaries:
            reason = profile["MAIN_BUSINESS"]
            terms = list(dict.fromkeys(m.group() for m in AI_TERMS.finditer(reason)))
            detail = f"东方财富公司档案的主营业务说明提及{'、'.join(terms[:3])}。"
            tags.extend(terms[:3])
            evidence_url = source_url(code, "BASIC_ORGINFO")
        elif matches:
            term = "人工智能" if "人工智能" in matches else next(iter(matches))
            detail = f"东方财富将公司纳入「{term}」板块。"
            if industry:
                detail += f"公司档案行业为{industry}。"
            tags.append(label(term))
        else:
            detail = "中证指数公司将该证券纳入人工智能主题相关指数。"
        if not tags:
            tags = ["人工智能"]
        # Generic semiconductor/robotics boards can supply context for already
        # included firms, but never imply a specific AI customer or sale.
        sources.extend(
            themes[n]
            for n in list(dict.fromkeys(qualifying + list(matches)))
            if n in themes
        )
        if profile:
            sources.append("cn-profiles")
        sources.append(registry[suffix])
        aliases = [
            s
            for s in [profile.get("ORG_NAME"), profile.get("ORG_NAME_EN")]
            if s and s != name
        ]
        out = dict(
            name=name,
            ticker=ticker,
            venue={"SH": "SSE", "SZ": "SZSE", "BJ": "BSE"}[suffix],
            sector=sector,
            segments=list(dict.fromkeys(tags))[:10],
            detail=detail,
            sources=sources,
            aliases=aliases,
        )
        out["relationship"] = role
        if evidence_url:
            out["evidenceUrl"] = evidence_url
        hk = re.fullmatch(r"(\d{1,5})\.HK", profile.get("STR_CODEH") or "")
        if hk:
            out["hkTicker"] = hk[1].zfill(5)
        result.append(out)
    assert len(result) == len({r["ticker"] for r in result})
    assert len(SOURCES) == len({r["id"] for r in SOURCES})
    return dict(
        market="CN",
        asOf=DATE,
        methodology=f"以上海、深圳、北京交易所 {len(active)} 只在册人民币普通股为底表。检索公司档案主营业务、26 个直接相关主题板块、21 个配套板块和 20 个 AI、算力及机器人指数，并匹配 2 只机器人基金的沪深持仓及具名公司资料。配套板块新增样本须有 AI 关键词或独立业务证据。板块可收录研发、合作、参股及采购关系，行业主类用于导航。未在这些资料中提及的关系可能遗漏。",
        sources=SOURCES,
        companies=result,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temporary:
        CACHE = args.cache or Path(temporary)
        CACHE.mkdir(exist_ok=True, parents=True)
        dataset = compile_data()
        dest = ROOT / "data" / "cn.json"
        dest.write_text(json.dumps(dataset, ensure_ascii=False, indent=1) + "\n")
        print(
            f"{len(dataset['companies'])} listings; {len(dataset['sources'])} sources"
        )
