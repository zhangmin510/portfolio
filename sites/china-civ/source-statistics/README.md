# 2024 年省级指标与城市气象

`regions-2024.csv` 收录 31 个内地省级地区的 21 项指标，以及年鉴另列的香港、澳门、台湾三个地区的两项专利指标。空白表示原表没有该项记录。省级 GDP、收入与就业等指标指行政区域整体，城市气象数值指原表列出的城市。

## 资料与列定义

| 资料 | 使用的列 |
| --- | --- |
| [中国统计年鉴 2025 · 表 3-9](https://www.stats.gov.cn/sj/ndsj/2025/html/C03-09.jpg) | 2024 年地区生产总值，三次产业增加值，人均地区生产总值和按不变价格计算的同比增长率。增长率由表中上年为 100 的指数减去 100。 |
| [表 2-7](https://www.stats.gov.cn/sj/ndsj/2025/html/C02-07.jpg) | 年末人口、城镇人口占比、出生率、死亡率、自然增长率。三个率的单位为千分比。 |
| [表 4-3](https://www.stats.gov.cn/sj/ndsj/2025/html/C04-03.jpg) | 2024 年底就业人数以及三次产业就业人数。 |
| [表 6-18](https://www.stats.gov.cn/sj/ndsj/2025/html/C06-18.jpg) | 2024 年居民人均可支配收入。 |
| [表 20-20](https://www.stats.gov.cn/sj/ndsj/2025/html/C20-20.jpg) | 三种国内专利的授权数合计及其中发明专利的授权数。 |
| [国家统计局关于 2024 年粮食产量数据的公告，表二](https://www.stats.gov.cn/sj/zxfb/202412/t20241213_1957744.html) | 粮食播种面积、总产量与单位面积产量。 |
| [表 8-4](https://www.stats.gov.cn/sj/ndsj/2025/html/C08-04.jpg) 与 [表 8-6](https://www.stats.gov.cn/sj/ndsj/2025/html/C08-06.jpg) | `city-weather-2024.csv` 中 34 座城市的年平均气温（摄氏度）与全年降水量（毫米）。 |

年鉴图片由 OCR 初读后按原图逐列校对，粮食数据取自公告 HTML 表格。天气表的 68 个值经过两次独立转录核对。修改 CSV 后在站点目录运行 `python3 scripts/build_statistics.py`，可重建 `statistics.json` 并检查产业增加值、分产业就业人数、人口自然增长率及粮食产量。年鉴原值独立取整，少数分项相加会产生尾差。

## 交通、能源、资源与教育

`transport-resources-education.csv` 按原表省级顺序转录六项指标。用电量取 [表 9-14](https://www.stats.gov.cn/sj/ndsj/2025/html/C09-14.jpg) 的 2024 年列，铁路营业里程与高速公路里程取 [表 16-3](https://www.stats.gov.cn/sj/ndsj/2025/html/C16-03.jpg)，货运量取 [表 16-13](https://www.stats.gov.cn/sj/ndsj/2025/html/C16-13.jpg) 合计列。普通、职业高等学校数来自 [表 21-15](https://www.stats.gov.cn/sj/ndsj/2025/html/C21-15.jpg)。森林覆盖率来自 [表 8-21](https://www.stats.gov.cn/sj/ndsj/2025/html/C08-21.jpg)，统计期为第九次全国森林资源清查（2014—2018 年），年份单列在指标元数据中。

广东高速公路里程 11,743 公里和全社会用电量 9,121 亿千瓦时（取整）经 [广东省统计局公报](https://stats.gd.gov.cn/attachment/0/576/576336/4686764.pdf) 交叉核对。31 地高校合计 2,870 所，与 [教育部公报](https://www.moe.gov.cn/jyb_sjzl/sjzl_fztjgb/202506/t20250611_1193760.html) 的普通本科、本科层次职业学校及高职（专科）三项之和相符。
