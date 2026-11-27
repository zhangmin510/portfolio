# 台湾县市户籍人口与制图位置

人口取自内政部户政司《村里戶數、單一年齡人口》，截面为民国 113 年 12 月底（2024-12-31）。以 7,748 个村里的一岁年龄、性别、户数汇总至 22 个县市，包括金门、连江及澎湖。居民按户籍登记地计入，统计单元采用户政区划，与本项目大陆 2020 年人口普查表独立展示。[开放数据目录](https://data.gov.tw/dataset/32973) · [2024 年 12 月原始 API](https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/11312)

县市代码取原表 11 位村里代码的前 5 位，金门、连江保留前导零。每个村里逐项核对男女人数、0–100+ 单岁人数合计均等于本村里人口。年龄字段按周岁合并，0–14 岁、15–64 岁和 65 岁及以上以人数记录。

另与户政司 2025-01-10 发布的《民國113年12月戶口統計資料分析》逐项核对，22 个县市合计为 23,400,220 人、9,487,480 户；男性 11,526,193 人、女性 11,874,027 人；三个年龄组分别为 2,742,386 人、16,169,127 人及 4,488,707 人。[核对公报](https://www.ris.gov.tw/info-liferay/app/channel/newsDetail/25010858)

县市界线和英文名据内政部国土测绘中心《直轄市、縣市界線（TWD97 經緯度）》，采用资料包 `COUNTY_MOI_1090820`（2020 年 8 月）。以同一五位县市代码联结人口表，另核对完整繁体县市名。定位取最大连通区域内的代表点，便于地图跳转；县市界内的山地也可能是代表点。图面坐标沿用 TWD97 经纬度（EPSG:3824），在全国地图显示尺度可直接与经纬度底图叠加；边界以 0.0015 度容差保留拓扑地简化，保留海岛与环洞。[开放数据目录](https://data.gov.tw/dataset/7442) · [原始图资下载页](https://maps.nlsc.gov.tw/pro/download.jsp)

人口数据与边界数据依政府资料开放授权条款第 1 版提供；人口摘录、简体名称、区域内代表点与概化边界在本项目中生成。原始声明与提供机构已列于图层的 `sources` 字段。[授权条款](https://data.gov.tw/license)

## 离线复现

在本目录运行 `python3 build_population.py` 将保存的源字段摘录再生为 `data/tw-localities.json`。默认构建只需要 Python 标准库。`villages-202412.csv.gz` 保留每村里代码及构成三组年龄、性别、户数的七项统计量；`county-map-extract.json.gz` 保留制图所需的名称、点位和概化环。

要从原始资料重新提取，先按页码 1–4 下载同一月份 API，例如：

```sh
curl -fLsS 'https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/11312?page=1' -o page1.json
```

其余三页依序保存为 `page2.json`、`page3.json`、`page4.json`。从国土测绘中心下载上述 SHP 资料包。随后运行：

```sh
uv run --with 'pyshp==3.1.9' --with 'shapely==2.0.7' python build_population.py \
  --pages page1.json page2.json page3.json page4.json --geometry county.zip
```

脚本验证四页回执、村里代码唯一性、县市匹配与七项合计，并核对边界图资的 SHA-256。
