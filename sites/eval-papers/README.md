# EvalPapers · 评测论文阅读室

一个独立实现、可本地运行的论文发现与阅读清单工作台，受 [Karpathy 的 arxiv-sanity-lite](https://github.com/karpathy/arxiv-sanity-lite) 启发，聚焦模型、AI 搜索 / RAG、应用与 Agent 评测。

首版带 **20 篇真实论文**。标题、作者、发表日期与版本经 arXiv 官方 Atom API 核验，中文短述与阅读问题由本项目独立整理。包括 SWE-bench、BrowseComp、GAIA、τ-bench、WebArena、OSWorld、AndroidWorld、Ragas、ARES、RAGChecker 和两个不同的 CRAG 项目。没有虚构引用量、热度和质量评分。

## 启动

需要 Node.js 22 或更高版本，无需安装依赖。

从作品集仓库根目录运行。

```sh
cd sites/eval-papers
npm run dev
```

打开 **http://localhost:4322**。服务仅监听本机；可使用 `PORT=4332 npm run dev` 更换端口。

## 功能

- 论文搜索、四个主题、发表时间排序和详情阅读。
- 收藏、忽略、恢复推荐、自定义标签和按标签筛选。
- 基于收藏的 TF-IDF 文本余弦相似度推荐，加上显式主题偏好。未设置偏好时按编辑阅读顺序排列。
- 论文详情包含作者、版本、日期、arXiv 与 PDF 原文链接，代码链接仅在原始论文或已核验资料中出现时提供。
- JSON 阅读清单备份和导入，Markdown 清单导出，浏览器本地保存收藏与标签。
- 响应式中文界面；`/` 聚焦搜索，原生对话框支持键盘关闭。
- `GET /api/papers` 返回公开快照，`GET /api/health` 返回本地服务状态。

“相关度”是文本与主题匹配，不代表论文质量、引用量或可复现性。本项目不调用 LLM、不发送阅读偏好到外部，也不声称实现原项目的 SVM 推荐算法。

## 数据更新

```sh
npm run update-data
```

更新流程从 `data/manifest.json` 读取人工整理的 arXiv ID，向官方 API 批量请求元数据，验证全部论文返回后才原子替换 `data/catalog.json`。网络失败、XML 无效或记录不完整时保留原快照。该命令刷新选定论文的元数据，不会自动增加未经审阅的论文，也不会重新生成中文摘要。

离线导入已保存的官方 Atom 响应：

```sh
npm run update-data -- --source /absolute/arxiv.xml
```

`--output /absolute/catalog.json` 可用于独立验证输出。原始 Atom 响应只用于临时核验，项目不会转载完整英文摘要或论文 PDF。新增论文需要先在 `manifest.json` 提供确切 ID、主题与独立阅读提示。

## 检查与构建

```sh
npm test
npm run build
```

`dist/` 是可由任意静态 HTTP 服务托管的前端与数据快照，使用 hash 路由。不要使用 `file://` 双击 HTML，浏览器会限制读取 JSON。

测试覆盖推荐的相似度、收藏与忽略、组合筛选、XML 解析、去重、来源字段、文件路径隔离和更新失败时的数据保留。测试不访问外网或计费 API。

## Cloudflare 发布

线上地址：[evalpapers.zhangmin.name](https://evalpapers.zhangmin.name)。使用 Cloudflare Workers 和 Static Assets，域名及资产配置保存在 `wrangler.jsonc`。

```sh
npm install
npm run types:cloudflare
npm run deploy:dry
npm run deploy:cloudflare
```

首次部署需要使用有 Worker、路由与域名权限的 Cloudflare 账号登录 Wrangler。`npm run preview:cloudflare` 在本机 `8822` 端口运行 Cloudflare 模拟环境。

发布只包含 `dist/` 的页面、脚本、样式和公开论文快照，以及只读 API Worker，不包含 `.env`、运行目录或个人阅读数据。`GET /api/papers` 与 `GET /api/health` 在线上继续可用；不存在的地址返回 404，API 不接受写入。收藏、忽略、标签和阅读偏好仍保存在访问者自己的浏览器，线上与 localhost 之间不会自动同步，可通过 JSON 导入导出迁移。

备用入口：[evalpapers.zhangmin.workers.dev](https://evalpapers.zhangmin.workers.dev/)，与正式域名使用同一个 Worker 和公开数据。版本预览仍关闭。不同域名的浏览器收藏相互独立，可通过 JSON 导入导出迁移。

## 数据来源与边界

- 原始元数据：[arXiv API](https://info.arxiv.org/help/api/index.html)，每条论文保留官方链接和核验日期。
- 概念与产品灵感：[karpathy/arxiv-sanity-lite](https://github.com/karpathy/arxiv-sanity-lite)。本项目不是该仓库的官方产品或维护分支。
- 论文与作者信息属于各自权利人；中文短述由本项目整理，全文仅链接至发布者。
- 这是人工精选的论文快照，不是实时论文流或引用排行榜。收藏和标签属于当前浏览器，清理浏览器数据前请先导出。
