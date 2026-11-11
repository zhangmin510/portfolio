# EvalTube

**EvalTube · AI 评测**，在独立目录中复刻 [Karpathy 的 HackerTube](https://hackertube.org/)，围绕模型评测、AI 搜索、应用评测和 Agent 评测组织内容，并保留相关技术基础。白底橙色的界面、视频中段缩略图、HN 推荐证据、本地收藏等体验参考原站，前端重新实现。

当前共 **55** 条视频：从 **6,454** 条原站视频中人工审阅选出 **49** 条，另补 **6** 条有核验来源的编辑精选；保留 **384** 条原始 HN 评论。AI 搜索 **6** 条、应用评测 **19** 条、Agent 评测 **4** 条、模型评测 **22** 条，主题允许交叉。评测包含实验、实测、方法演示与效果研究，不等同于标准化 benchmark。

## 本地运行

需要 Node.js 22 或更高版本。本地浏览与服务没有运行时依赖，不必运行 `npm install`；Cloudflare 部署使用项目内的 Wrangler 开发依赖。

从作品集仓库根目录运行。

```sh
cd sites/evaltube
npm run dev
```

打开 **http://localhost:4317**。服务仅监听本机 `127.0.0.1`。如果端口被占用，可以使用 `PORT=4318 npm run dev`。

## 已实现

- 四个独立频道：模型评测、AI 搜索、应用评测、Agent 评测，并提供对应主题片单。
- AI 搜索涵盖搜索产品任务对比、RAG 答案正确性、检索相关性和检索方案对比。
- 应用评测包括助手、插件、AI 设备和工作流实测；Agent 评测保留任务完成、代码验证与能力宣称核验。纯架构教程另归“Agent 技术”。
- 保留大模型入门、架构、训练与对齐、推理与使用、多模态主题。
- 搜索标题、作者、摘要与标签；支持“大模型 / 评测 / 卡帕西 / 幻觉”等常见中文查询。
- 按精选排序、发布日期、最近被提及年份、视频时长排序；按时长、难度、内容形式与长期有效性筛选。
- 详情页包含 YouTube 播放器、摘要与具体入选理由。HN 视频展示真实推荐和评论；编辑精选展示原始来源及核验日期，不显示虚构 HN 证据。
- 历史版本的产品对比保留评测年代并标记“历史版本评测”，不代表当前产品排名。
- 喜欢、不喜欢、稍后观看、已打开历史；收藏文件导入导出；本地偏好轻量影响推荐。
- 浅色 / 深色 / 跟随系统，真实中段画面与原始封面切换，手机布局与键盘操作（`/` 搜索、`Esc` 关闭）。

数据是本地快照，浏览不会实时抓取新视频。视频播放与封面需要访问 YouTube；发布者或地区限制可能影响嵌入，详情页提供原视频链接。

## 更新数据

```sh
npm run update-data
```

更新脚本使用 HackerTube 公开导出，不需要 API Key；同时合并 `scripts/supplemental-videos.json` 中经过核验的补充视频。人工审阅的允许与排除清单在 `scripts/selection-manifest.json`；新候选进入 `data/review-queue.json`，审阅后才纳入频道，避免主题漂移。上游读取或验证失败时保留原数据。

```sh
npm run update-data -- --offline
```

离线重建依赖先前拉取到系统临时目录的源数据。字段、许可和更多参数见 [data/SCHEMA.md](data/SCHEMA.md)。

## 检查和静态构建

```sh
npm test
npm run build
```

`dist/` 可以放入任意静态 HTTP 服务，页面使用 hash 路由，无需配置路由回退。不要双击 HTML 用 `file://` 打开，因为浏览器会限制读取 JSON。

YouTube 时长、发布日期和播放量保存在 `data/youtube-metadata.local.json`，只供本地预览，默认忽略版本管理与静态分发。静态构建不带此缓存，因此会省略时长、日期与播放量，禁用相关筛选和排序；其余浏览、播放、评论与收藏可用。原站的开放导出不包含这些元数据，详见其数据许可说明。

## Cloudflare 部署

发布地址：**https://evaltube.zhangmin.name**。使用 Cloudflare Workers Static Assets，配置见 `wrangler.jsonc`，仅绑定该自定义域名。页面使用 hash 路由，不需要 SPA 回退。

```sh
npm ci
npm run deploy:dry
npm run deploy
```

部署使用现有 Wrangler 登录；账号凭据由 Wrangler 管理，不写入项目。自定义域名的 DNS 与证书由 Cloudflare 管理。

更新视频后重新发布：

```sh
npm run update-data
npm run deploy
```

2026-11-06 首次部署版本：`935ee764-0af0-460b-bfe1-fcf3a0c66015`。线上为静态版：55 条视频、384 条 HN 评论；本地专用的 YouTube 元数据缓存不上传，时长与发布日期筛选仅在本地缓存可用时启用。

## 目录

```text
public/                      页面、样式与浏览器逻辑
data/catalog.json            已审阅视频及主题
data/comments.json           真实 HN 评论
data/youtube-metadata.local.json  本地可选元数据（不分发）
scripts/update-data.mjs      在线更新与离线重建
scripts/selection-manifest.json  人工允许/排除清单
scripts/supplemental-videos.json  原库以外的编辑精选与来源
tests/                       数据与交互逻辑测试
server.mjs                   零依赖本地服务
build.mjs                    静态打包
wrangler.jsonc               Cloudflare 自定义域名与发布配置
```

HN 原库数据归属 **HackerTube** 和 [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news)，遵循 **ODC-By 1.0**；原始说明保存在 [data/DATA-LICENSE.md](data/DATA-LICENSE.md)。编辑精选摘要由本频道整理，并逐条保留原始来源链接；ODC-By 仅适用于 HN 原库开放导出。视频与评论属于各自创作者。此项目为独立本地复刻，与 Karpathy 和原站无隶属关系。
