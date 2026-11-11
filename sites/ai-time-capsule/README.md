# AI Time Capsule

把 AI 产品发布时的能力主张，与后来的证据放在同一条时间线上。受 [Karpathy 的 HN Time Capsule](https://github.com/karpathy/hn-time-capsule) 和 [Auto-grade HN](https://karpathy.bearblog.dev/auto-grade-hn/) 启发。中文界面，支持 Cloudflare 网站与本地 Node.js 服务，无第三方运行时依赖，不调用付费 API 或 LLM。

## Cloudflare 线上版

访问 **[timecapsule.zhangmin.name](https://timecapsule.zhangmin.name)**。

线上版的公开种子、筛选与历史回看由 Cloudflare Workers 和静态资源提供。**个人新增、修改、导入、编辑历史保存在当前浏览器，完全不上传 Cloudflare，也不会与其他访客共享。** 新增、编辑、导入、全部/单条 JSON 导出均可使用；同一浏览器重开或刷新可继续查看记录。清除浏览器数据、隐私窗口结束或更换设备后不会自动同步，请使用页头“导出档案”备份，再在“整理方法”中导入。

公开 `/api/*` 只读，只返回内置的 9 条公开种子；UI 的个人档案读写和导出在浏览器内执行。不能用公开 `/api/export` 备份个人修改，应使用页面的导出按钮。页面导出包含当前回看时点的可见资料，不包含完整编辑日志。浏览器存储达到上限时会明确提示，失败修改不会被伪装成保存成功。公开接口不包含本机 `runtime/archive.json` 或个人记录，没有账号和云同步。

```sh
npm install
npm run build:cloudflare
npm run preview:cloudflare  # http://localhost:8783，浏览器存储行为与线上相同
npm run deploy:dry
npm run deploy
```

Cloudflare 配置位于 `wrangler.jsonc`，新 Worker 名为 `ai-time-capsule`，自定义域名为 `timecapsule.zhangmin.name`。只发布 `dist-cloud/` 和 Worker 的公开种子，不发布 `runtime/`、环境文件、测试记录或本地归档。`worker-configuration.d.ts` 由 `wrangler types` 生成。

## 运行

需要 Node.js 22 或更高版本。

从作品集仓库根目录运行。

```sh
cd sites/ai-time-capsule
npm run dev
```

打开 <http://localhost:4323>。可用 `PORT=4328 npm run dev` 改端口。服务绑定本机 `127.0.0.1`，适合个人本地使用。

```sh
npm test
npm run build
npm start
```

`build` 校验种子数据并将前端资源复制到 `dist/`；仍需 Node 服务提供档案 API。修改前端后重新 build，或删除 dist 后直接运行 dev。

## 已实现

- 模型能力、AI 搜索、AI 应用、Agent 四个领域；时间线、关键词、状态和自建档案筛选。
- 原始主张、适用条件、原始来源，以及按日期排列的后续证据。
- 人工判断单独注明作者、日期、依据及不确定性；不使用模型打分冒充事实。
- 回看指定日期：隐藏未来主张、证据及人工判断，搜索和导出也遵循同一时点。后来的本地编辑不会改写更早的视图。
- 添加、编辑主张与证据；保存完整编辑前后版本；JSON 导入、单条及全部导出。
- 原始来源与证据均记录 URL、发布日期；每条档案记录 `verifiedAt`。

## 数据和判断的含义

`data/claims.json` 是 **2026-11-07 人工核验的种子快照**，有 9 条真实档案，覆盖 GPT-4、GPT-4o、Sora、GitHub Copilot、Google AI Overviews、ChatGPT Search、Claude computer use、Operator 与 deep research。主要来源是官方发布、论文和官方更新；Copilot 的后续研究来自 METR。

来源摘要是中文编辑短述。**证据是来源所报告的内容；状态是编辑观点。** 官方声明并不等于独立复现。记录中的判断均于整理日形成，没有回填到产品发布日。选择较早日期时，可能已经看见当时发表的证据，但没有整理日之后的判断。没有可比实验时保留“尚待观察”，没有为展示效果强行标为“被反驳”。不同工具、任务或受试者的研究，不能直接当作相同实验的反证。

“回看日期”按资料和判断的记录日期过滤，不声称重建互联网当日的真实快照。原始页面可能继续更新；本项目保存编辑摘要和链接，不保存网页全文或历史页面。种子中的原始主张只描述发布时的信息，同一更新页内的后续内容独立作为证据记录。

## 持久化与导入

本地 Node 模式下，第一次修改会写入 `runtime/archive.json`，包含种子、自建内容和编辑历史。文件以临时文件写入再原子替换，同进程修改按顺序执行。该目录已被 git 忽略。备份此文件可保留编辑历史；UI 导出是当前可见资料交换格式，不包含全部编辑日志。删除 runtime 后恢复种子快照。线上版使用当前浏览器的 localStorage，与此文件互不关联。

界面的“整理方法”里可以导入 JSON。也可停止服务后运行：

```sh
npm run import -- /absolute/path/archive.json
```

支持 `{ "version": 1, "claims": [...] }` 或档案数组。以 ID 合并，重复 ID 更新且保存前一个版本；整个文件通过日期、字段、证据关联及 HTTPS 来源校验后才写入。批次内重复 ID 会拒绝。导入资料按自建档案处理。导入和服务共享同一本地文件，因此不要同时使用 CLI 和服务写入。

可选的只读链接检查：

```sh
npm run check-sources
```

它只检查种子 URL 的 HTTP HEAD 连通性，不验证事实，也不会自动修改 `verifiedAt`。部分网站会拒绝 HEAD，需人工打开核对。

## API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/config` | 领域、状态和日期配置 |
| GET | `/api/claims?asOf=2025-12-31&topic=agents` | 按时点筛选，另支持 q、status、own、sort |
| GET | `/api/claims/:id?asOf=2025-12-31` | 证据链详情 |
| GET | `/api/claims/:id/history` | 可见编辑版本 |
| POST | `/api/claims` | 添加档案 |
| PUT | `/api/claims/:id` | 编辑档案 |
| POST | `/api/import` | 校验并合并资料 |
| GET | `/api/export?asOf=2025-12-31` | 导出可见资料 |
| GET | `/api/health` | 本地健康状态 |

本地 Node 服务写入请求使用 `application/json`，请求体最大 2 MB。来源只接受不含凭据的 HTTPS URL。服务拒绝携带其他站点 Origin 的修改请求。当前没有多人身份认证、数据库、自动抓取、定时更新或云端同步；线上版通过浏览器私有存储隔离个人修改，不开放共享写接口。

## 验证范围

15 项测试涵盖未来证据和结论过滤、搜索不泄漏未来证据、来源日期约束、判断依据约束、日期/链接校验、编辑历史还原、导入批次校验、持久化和并发串行写入，以及 HTTP 快照导出和写入保护；另验证浏览器访客隔离、刷新恢复、个人 JSON 导出、导入及存储失败时保持原数据、公开 Worker API 只读与 404 行为。
