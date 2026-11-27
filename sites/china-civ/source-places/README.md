# 地名、遗产与城市统计

在此目录执行以下命令，可以用随项目保存的源数据重建两份前端 JSON。需要 Python 3.8 或以上版本。

```sh
python3 build_places.py
python3 build_city_indicators.py
```

## 城镇与省级地区

城镇点来自 GeoNames 2026-11-26 的 `cities15000` 文件，以及 CN、HK、MO、TW 的中文别名文件。GeoNames 使用 WGS84 坐标，数据依据 CC BY 4.0 提供。本项目筛选城镇及各级行政驻地，保留带中文名和地区归属的记录，选取现代名称，统一为简体并补充搜索别名。少数简繁、拼音和省级归属经过校正。每个点的 `gn-数字` 对应 GeoNames 记录号。[GeoNames](https://www.geonames.org/) · [下载目录与字段定义](https://download.geonames.org/export/dump/readme.txt) · [许可](https://creativecommons.org/licenses/by/4.0/)

成品收录 1,559 个城镇、城区或驻地点，覆盖 34 个省级地区。地图标注优先级根据行政驻地和 GeoNames 收录人口分档。城市人口取自原始记录，各条目的年份及行政或聚居地口径可能不同，不能合计为全国人口。两条明显疑似错配的人口已省略。省级人口另取自官方七普公报中的 2020 年 11 月 1 日零时常住人口，适用范围为大陆 31 省区市。[第七次全国人口普查公报（第三号）](https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902003.html)

`regions.tsv` 中的地区坐标为手工选择的标签位置，地区和部分城市的地理说明为本图编辑文字。原始 GeoNames 更新时，可将 `cities15000.zip` 与 `alternatenames/` 下的 `CN.zip`、`HK.zip`、`MO.zip`、`TW.zip` 下载在同一目录，再运行以下命令更新压缩摘录。生成器用 ICU 统一简繁、辅助匹配地名，发布版本可离线重建。

```sh
python3 build_places.py --extract /path/to/downloads --uconv /path/to/uconv
```

## 世界遗产

遗产地名、入选年、类别和组成地坐标取自 UNESCO DataHub 的 WHC001（数据集更新于 2026-11-22）。地图覆盖名录中国条目的 61 项世界遗产，包括文化遗产 42 项、自然遗产 15 项和双重遗产 4 项。每项只绘制一个组成地坐标，跨省和跨国项目的显示地区指向所选组成地。系列遗产可打开 UNESCO 条目查看其它地点。地图编辑了中文短名、每项简介和代表点选择，整套衍生遗产图层以 CC BY-SA 4.0 发布。[UNESCO DataHub](https://data.unesco.org/explore/dataset/whc001/) · [数据集及许可元数据](https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001) · [中国遗产名录](https://whc.unesco.org/en/statesparties/cn/) · [许可](https://creativecommons.org/licenses/by-sa/4.0/)

`unesco-extract.json.gz` 按编号存储对应 UNESCO 条目的原始限定字段。`heritage.tsv` 保存编辑后的中文名、文字和代表点的省级地区。指定 ref 时按 UNESCO 组成地编号选择，否则用保存快照中列出的第一个组成地。上游查询如下。

```sh
curl -Gs 'https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records' \
  --data-urlencode 'where=iso_codes like "cn"' \
  --data-urlencode 'select=id_no,name_zh,name_en,date_inscribed,category,components_list' \
  --data-urlencode 'limit=100'
```

## 城市统计和游戏标签

`city-indicators.tsv` 从《中国统计年鉴2025》表 25-2 逐行录入 36 个城市的 12 项指标，包括全市及所辖县，数据年份为 2024。GDP 和三次产业增加值使用当年价格。用中文城市名匹配驻地或主要城市，生成器要求每行唯一匹配，并校验三次产业合计与 GDP 的舍入误差。只显示表中所列城市。城市统计与省级统计分别存放。[国家统计局原始数据表](https://www.stats.gov.cn/sj/ndsj/2025/html/C25-02.jpg)

游戏标签标记城市统计特征，空间上对应市域整体。农业区、工业区、商业区的门槛分别为第一产业占比至少 5%、第二产业占比至少 40%、第三产业占比至少 70%。外贸区要求货物进出口总额与 GDP 的比值至少 50%。学院要求普通、职业本专科在校学生至少 50 万人，医疗区要求医院至少 300 个。这些门槛是地图编辑规则，一个城市可以得到多个标签。
