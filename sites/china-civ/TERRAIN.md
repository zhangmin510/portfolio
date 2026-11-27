# 地形与底图数据

浏览器读取项目内的 `data/geography.json` 和 `data/relief.png` 即可绘制地图。两份数据都采用 WGS84 经纬度，制图窗口为东经 70°–137°、北纬 15°–55°。海岸与行政区是全国尺度的概化示意，窗口以外的岛屿不在本图覆盖范围内。

| 内容 | 来源与处理 |
| --- | --- |
| 海岸、河湖、区域轮廓 | [Natural Earth 1:50m](https://www.naturalearthdata.com/downloads/50m-physical-vectors/)。陆地 v4.1.0，河流、湖泊 v5.0.0，行政区面 v5.1.1，省界线 v5.1.0。裁剪至制图窗口，简化容差为 0.014°。区域着色取 31 个省级面，另取香港、澳门、台湾的轮廓。该数据集为公有领域作品。[使用条款](https://www.naturalearthdata.com/about/terms-of-use/) |
| 海拔与地貌明暗 | Amante, C. 与 B. W. Eakins，2009，[NOAA ETOPO1 1 Arc-Minute Global Relief Model](https://doi.org/10.7289/V5C8276M)。从 [NOAA NCEI 的 ETOPO1 Bedrock 服务](https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/ETOPO1_bedrock/ImageServer) 双线性重采样到 0.05°。根据高程梯度生成西北光照阴影，适当增强阴影以便在六边格上阅读。NOAA 允许公众使用和再分发，要求标注 NCEI 来源，并限定非导航用途。[使用说明](https://www.ncei.noaa.gov/sites/default/files/2023-01/Frequently%20Asked%20Questions.pdf) |
| 植被与土地利用 | Friedl, M. 与 D. Sulla-Menashe，[NASA MODIS MCD12Q1](https://doi.org/10.5067/MODIS/MCD12Q1.061)。通过 NASA EOSDIS 的 Global Imagery Browse Services 获取 2024 年 Terra/Aqua 联合 IGBP 分类，按[发布者图例](https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_IGBP_Land_Cover_Type.xml)解码，最近邻取样至地形网格。NASA 地球科学标准数据公开共享。[数据发布政策](https://pub.earthdata.nasa.gov/data_publication_guidelines) |

在草原、树林、耕地、建成区、裸地、湿地、水体和冰雪类别上叠加 ETOPO1 海拔与坡度，生成游戏中的高地与山地。游戏图标表达网格的代表性地貌。一格可能涵盖多种地表覆盖，读出的海拔是概化网格值。

## 再生成

在本目录下运行以下命令。首次运行会将上游文件保存在指定缓存目录；保留该目录即可离线重建。脚本使用 Python 3.10+、NumPy、Pillow、pyshp 和 Shapely，依赖声明位于脚本开头。

```sh
uv run scripts/build_terrain.py --cache-dir /tmp/china-civ-terrain-cache
uv run scripts/build_terrain.py --cache-dir /tmp/china-civ-terrain-cache --offline
```

`geography.json` 的 `land`、`country` 和 `lakes` 是按奇偶填充的多边形环数组，`areas` 含区域名、代码和环数组，`provinces`、`rivers` 为折线数组。每个点都是 `[longitude, latitude]`。

`relief.png` 为 1340 × 800 的无损数据纹理，左上角的像元中心位于 70.025°E、54.975°N。红通道依次编码水域（0）、平原（1）、森林（2）、草原（3）、裸地（4）、湿地（5）、高地（6）、山地（7）、冰雪（8）、耕地（9）、城镇（10）。绿通道保存阴影，平地取 128。蓝通道保存高程，单位为 32 米，小于零的值记为零。
