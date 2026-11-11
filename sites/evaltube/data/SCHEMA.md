# 数据契约与更新

主体来源是 [HackerTube 开放数据](https://hackertube.org/data)，归属 **HackerTube** 与 [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news)。该开放数据使用 ODC-By 1.0，原始说明与许可证保存在 `DATA-LICENSE.md`。另有人工核验的外部编辑精选，逐条保留发布者来源与核验日期，不冒充 HN 推荐。HN 评论属于各自作者，视频属于各自创作者。

`catalog.json` 顶层含 `meta`、`topics`、`videos`。每条视频保留原始 JSONL 字段（`vid`、`title`、`summary`、`why_hn`、`hn`、`score`、`quote` 等），增加 `topics: string[]` 和中文 `selection_reason`。`quote.id` 是原字段 `hn_comment_id` 的兼容别名；`hn.first/last/strong` 分别是 `first_year/last_year/strong_recs` 的兼容别名。

`provenance.kind` 区分 `hacker-news`（HackerTube / HN 原库）与 `curated`（独立编辑精选）。编辑精选必须有 `sourceName`、HTTPS `sourceUrl`、`verifiedAt`；其 `hn: null`、`score: 0`、`why_hn: ""`、`quote: null`、评论为空，前端应显示编辑精选及来源链接，不展示 HN 推荐或评论声明。`meta.totalHnVideos` 与 `meta.totalCuratedVideos` 合计为 `totalVideos`，`totalSourceVideos` 仅指上游原库候选数量。`meta.licenseScope` 明确 ODC-By 仅适用于 HN 原库视频记录及评论；外部精选为独立编辑摘要与原始来源链接，不承继原库许可证，原视频权利仍属于发布者。

`duration_s`、`published`、`views` 在开放目录中为 `null`。可选的 `youtube-metadata.local.json` 是仅供本地使用的元数据缓存，结构为 `{ fetchedAt, source, videos: { [vid]: { duration_s, published, views } } }`。客户端加载后按视频 ID 合并，仅合并这三个字段。该文件应忽略版本管理和公开分发；缺失时页面仍可完整浏览，时长筛选应说明元数据不足。更新会重新查询公开元数据端点，播放器与缩略图直接指向 YouTube。

`comments.json` 是 `{ [vid]: Comment[] }`。Comment 含 `id`、`author`、`ym`（`YYYY-MM`）、`story`、`text`、`stance`、`why`、`url`。`[VIDEO]` 和 `[LINK]` 是原始评论中的链接替换标记，渲染时先转义再格式化；不要把评论文本当作 HTML。

`meta.sourceGeneratedAt` 记录原站导出时间，`fetchedAt` 是本次拉取时间，不能把它当作逐条视频的发布日期。`score` 是 HackerTube 原始 HN 推荐评分，不是模型分数。`evaluation` 分类包含真实任务演示、红队、失败观察与效果研究，不代表标准化 benchmark。

## 筛选政策

`scripts/selection-manifest.json` 是原库视频人工审阅后的允许/排除清单，每条允许记录必须给出 topic 和具体入选理由。`scripts/supplemental-videos.json` 是原库之外的编辑精选，每条均须核验准确视频 ID 与发布者来源。`update-data.mjs` 用精确视频 ID 执行决定，再用 `llms-generative-ai` 分类与大模型、AI 搜索、应用和 Agent 专用关键词产生新候选 `review-queue.json`。未审阅的新候选不会自动进入目录，避免把影视作品、创业访谈、社会评论与纯营销混入。

当前范围包括大模型原理、架构、训练与对齐、推理与使用、模型能力评估，以及少量相关训练基础。新增三个互不等价的入口：`ai-search`（AI 搜索、RAG、语义检索与检索质量评估）；`app-evaluation`（AI 应用实际工作流、对比、效果研究和局限，含明确标注的功能实测演示）；`agent-evaluation`（Agent 执行具体任务、完成质量与失败分析）。原 `agents` 继续表示 Agent 技术与编程实践，架构介绍不会自动成为 Agent 评测。AI Pin 等 AI 产品的真实使用评测可纳入应用分类；纯产品发布与广告继续排除。

排除泛科技/AI 哲学、产业领导者宽泛长访谈、自动驾驶、AI 音乐与影像作品、无关产品评测。作者或厂商自己的演示仍标为 `content_type: demo`，不包装成独立评测。历史内容保留其年代与上下文，不推断其代表当前最佳模型或产品体验。

## 命令

从项目根目录运行 `node scripts/update-data.mjs` 拉取公开视频、评论、导出信息、许可说明和可选 YouTube 元数据。所有网络请求和验证成功后才替换数据；更新失败保留现有文件。

离线重建使用系统临时目录 `hackertube-ai-source` 缓存：`node scripts/update-data.mjs --offline`。也可提供 `--source /absolute/videos.jsonl --mentions /absolute/mentions.jsonl --export /absolute/export.json --data-doc /absolute/DATA.md`；加 `--offline` 关闭网络。`--metadata /absolute/metadata.json` 指定本地元数据；`--no-metadata` 跳过元数据。原始大文件只存在系统临时目录，不进入项目。

`node --test tests/data.test.mjs` 检查数据完整性与主题边界。
