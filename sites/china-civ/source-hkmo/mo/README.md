# 澳门人口、经济与统计分区

澳门特别行政区政府统计暨普查局及澳门金融管理局公布的数据，年份均为 **2024**。地图采用统计暨普查局 2021 人口普查的统计分区界线。

## 全澳

| 指标 | 数值 | 年份与口径 |
| --- | ---: | --- |
| 年末总人口 | 688,300 人 | 2024 年末。包括本地人口、居澳的外地雇员和外地学生。本地人口为 568,700 人。《人口统计》将总人口定义为常住人口及流动人口之和。[统计暨普查局年报](https://www.dsec.gov.mo/getAttachment/3827c09a-ab7b-4c40-8aa1-8fee04195f8e/C_DEM_PUB_2024_Y.aspx) |
| 全年 GDP | 397,560 百万澳门元 | 当年价格，按百万澳门元取整。统计暨普查局于 2025 年 11 月对历史数据作主要修订。2026 年第二季《澳门经济季刊》仍列此数。GDP 表提供全澳总量和组成，未列按这 23 个统计分区编制的 GDP。[主要修订报告表一，第 48 页](https://www.dsec.gov.mo/getAttachment/73F3560A-F9D1-492E-8660-EE31CB84E8D7/2025_11_14.aspx#page=48) · [经济季刊](https://www.dsec.gov.mo/getAttachment/339aa4c9-5991-4963-80e8-a241d1a5560d/E_BET_PUB_2026_Q2.aspx) |
| 全年平均汇率 | 1 人民币元兑 1.11534 澳门元 | 澳门金融管理局的期内平均汇率原表按每百外币计，2024 全年人民币一列为 111.534。按此汇率折算，GDP 约为 3,564.5 亿元人民币。[金融管理局数据集](https://data.gov.mo/Detail?id=2cc3fd63-d857-48ce-82f6-35e5677713b9) · [经济季刊汇率表，刊至小数点后两位](https://www.dsec.gov.mo/getAttachment/c8183ec8-4e65-4ed4-8b40-b33318192cee/E_BET_PUB_2024_Q4.aspx) |

## 分区人口与住房

《人口统计 2024》第 6 表逐区列出年中和年末总人口，单位为千人，保留一位小数。程序乘以 1,000 展示为人，原表精度是百人。地图中 23 个陆上统计分区年中合计 686,200 人，年末合计 687,500 人。年中和年末另有水域各 800 人，分别与全澳 687,000 人和 688,300 人核对相符。大学及北安湾区含澳门大学横琴校区人口，路环区含路氹填海区人口。[统计暨普查局分区人口原表，第 34 页](https://www.dsec.gov.mo/getAttachment/3827c09a-ab7b-4c40-8aa1-8fee04195f8e/C_DEM_PUB_2024_Y.aspx#page=34)

住房取自 2024 年 12 月底的楼宇及单位总档案。23 区合计住宅单位 245,303 个，其中空置 15,078 个。统计局按未装电表、极低用电量或实地核实无人占用识别空置单位，正在装修的单位除外。计算时采用两个「合计」栏并核对各面积组，原表横杠在此表的注释中明确定义为零。[统计暨普查局住宅及空置住宅原表，第 4 页](https://www.dsec.gov.mo/getAttachment/271a2006-126d-445b-a0d8-d6ac60accef4/2025.aspx#page=4)

## 界线与复现

区名和区域编号取自统计暨普查局 2021 普查 GIS 图层的 `Desc_C`、`Desc_CN`、`Desc_P` 与 `Zona` 字段。地图展示 01–23 的 23 个陆上分区，以区名匹配两份 2024 统计表。水域人口保留在地区说明。制图沿用普查时的陆上界线，大学及北安湾区的图形展示氹仔部分。每个标签选在区内，生成时校验位置和面积。[统计地理资讯系统](https://www.dsec.gov.mo/gis/unidade/) · [官方多边形查询图层](https://www.dsec.gov.mo/CensusGIS/rest/services/Production2021/Census2021_Density23_TW_v2/MapServer/0)

原始查询结果保存在 `census-gis.json.gz`（2021 普查人口密度繁中图层 0）。该图层的服务头标注 WKID 3064，实际返回的原始顶点为澳门平面坐标，落在东距约 18,895–26,064 米、北距约 8,769–20,647 米。程序逐顶点校验范围，再按 Macao Grid（EPSG:8433）转至 WGS84。米制环按 3 米容差简化，忽略小于 1 平方米的碎片，保留洞与分离的多边形。生成的界线用于交互展示。[地图绘制暨地籍局坐标说明](https://www.dscc.gov.mo/files/geographical_geodetic_control/ENG/Macaucoord_2009_web_EN_v201702.pdf)

安装 Python、Shapely、pyproj、curl 与 Poppler 的 pdftotext 后，在本目录运行以下命令。脚本从政府站点取得三份 PDF，核验 PDF 和界线快照的 SHA-256 及统计行列。首次获取的文件保留在指定缓存目录，后续可离线重建。加上 `--verify-geometry` 会重新查询统计局图层，逐区与快照比对属性和原始坐标。

```sh
python3 build.py --cache /tmp/macao-civ-official
```

`exchange-2024.csv` 保留金融管理局 `fxRatePeriodAverage.xlsx` 中 `year=2024`、`month=null` 的全年原始行。要独立核对，可在[数据开放平台](https://data.gov.mo/Detail?id=2cc3fd63-d857-48ce-82f6-35e5677713b9)下载数据集，把下载的 ZIP 或解包的 XLSX 文件路径传入 `--exchange-file`。
