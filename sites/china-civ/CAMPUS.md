# 高校图层

以教育部直属高校为采样范围，将 2026 年 6 月 17 日的普通高校名录与教育部直属高校专页按学校名称匹配。名录提供学校名称、十位学校标识码、主管部门、办学层次和登记所在地，直属高校专页提供学校官网。两份资料共有 75 所符合条件的普通本科院校，分布在 18 个省级地区的 23 座城市。[教育部普通高等学校名单](https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202606/t20260618_1441074.html) · [教育部直属高等学校](https://hudong.moe.gov.cn/jyb_zzjg/moe_347/)

地图按名录登记的城市聚合展示，以 GeoNames 城市代表点定位。例如，北京大学和清华大学都出现在“北京”的高校列表中；西北农林科技大学使用名录中“咸阳市”的城市点。学校官网可查看具体校区。[GeoNames 数据，CC BY 4.0](https://www.geonames.org/export/)

英文校名与机构标识取自 Research Organization Registry。先按学校官网域名查询，其次按中文校名查询。只接受在中国、状态为 active 的教育机构，且官网域名或规范化校名能唯一匹配。本版 75 所学校均有唯一匹配的 ROR 标识与英文名。[ROR 数据条款，CC0](https://ror.org/about/terms/)

## 复现

运行以下命令可获取来源表并生成 `campus.json`。保留缓存后可离线重复运行。机构名称和网址可能随来源更新，使用同一缓存可复现相同的快照。

```sh
uv run scripts/build_campus.py --cache-dir /tmp/china-civ-campus-cache
uv run scripts/build_campus.py --cache-dir /tmp/china-civ-campus-cache --offline
```
