# AutoEval

受 [Karpathy 的 autoresearch](https://github.com/karpathy/autoresearch) 启发的检索配置实验工作台。首版把“固定评估 → 尝试配置 → 保留改进 / 回退 → 最终验证”用于 RAG 的 BM25 检索阶段。

## 启动

需要 Node.js 22.9 或更新版本。以下命令从主页仓库根目录运行。

```sh
cd sites/auto-eval
npm run dev
```

打开 http://localhost:4324 。服务只监听本机。可用 `PORT=其他端口 npm run dev` 改端口。

## 可用功能

- 内置 12 篇手工编写的教学资料、12 条调参查询和 6 条保留查询，均明确标为教学数据。
- 导入自己的文档与相关性标注，保存为独立数据集，支持查看标注和导出。
- 冻结数据集 SHA-256，真实计算 BM25 检索的 Recall@k、MRR、上下文字符和本机耗时。
- 自动比较分词、分块、重叠、Top K 配置；调参目标提高时保留，否则回退。
- 搜索结束后才对选定配置与基线执行保留集评估。保留集结果不参与候选选择。
- 预算、停止、失败记录、实验历史、逐查询检索证据、JSON 与 Markdown 报告导出。
- 可选 OpenAI 兼容建议模型。模型仅提出受约束 JSON 配置，评分由固定的本地计算器执行。

目标函数：`0.7 × Recall@k + 0.3 × MRR − contextPenalty × 平均上下文字符数 / 1000`。同一文档的多个分块只计一次召回；MRR 使用首个相关分块的排序位置。默认惩罚权重为 `0.02`，实验开始后固定。

这是检索质量实验，不是语言模型回答正确性、Agent 任务成功率或公开排行榜。上下文字符不等于 token 或账单。数据集小、单次计时存在波动；耗时只报告，不作为优化目标。内置文档和标注由本项目编写，以 CC0-1.0 提供。

## 可选模型配置

复制 `.env.example` 为 `.env`，设置 `AUTO_EVAL_API_KEY`、`AUTO_EVAL_BASE_URL`、`AUTO_EVAL_MODEL` 后重启。未配置时，本地候选搜索完全可用，模型建议不会伪装执行。API key 仅在服务端使用，不写前端、日志或结果导出。模型建议的请求包含候选配置与调参指标，不包含保留集指标或查询标签。

模型模式有真实 API 调用费用，请使用自己明确选择的服务商和模型。单次实验包含基线，最多 36 次预算；重复建议会跳过并记录，模型错误会结束为失败。停止时，已发出的模型请求可能需要等到返回或超时。

## 数据与复现

文件格式见 `data/demo.json`。每条查询的 `relevantDocIds` 必须引用存在的文档；`split` 为 `tuning` 或 `holdout`，各至少两条。导入最多 2MB / 500 篇文档 / 200 条查询。

用户数据和实验快照位于忽略版本管理的 `.runtime/`。重启后可继续查看完成记录；运行中被打断的记录显示为“已中断”，不假称完成。导出的实验 JSON 包含当次数据快照与配置，可用于复核；请注意其中可能含你导入的私有文本。

```sh
npm test
npm run build
```

`dist/` 是后端 + 前端运行包，进入该目录后 `node server.mjs` 启动，不能只上传为静态站。构建不含密钥和运行记录。可选 API 使用 OpenAI 兼容 `POST /chat/completions`。测试采用本地注入的假 provider，不调用计费服务。

## Cloudflare 线上版

地址：[autoeval.zhangmin.name](https://autoeval.zhangmin.name/)。Cloudflare Worker 提供静态页面、公开教学数据及健康检查；**真实 BM25 计算在访问者的 Web Worker 中执行，数据集和结果保存在当前浏览器的 IndexedDB**，不会上传文档、查询或实验记录。本机 `runtime`、`.runtime`、密钥和测试历史都不在发布目录。

在线版支持数据集导入、固定预算搜索、keep/revert、一次性保留集验证、逐查询明细、历史和 Markdown/JSON 导出。与 Node 版本共用同一引擎和实验编排，浏览器 SHA-256 与 Node 结果一致。在线版不连接付费建议模型；本地 Node 版本仍支持 `.env` 中的可选配置。

关闭计算页面会中断当前实验；重新打开或其他标签页轮询时会将遗留任务标为中断。Web Locks 保证同一浏览器在多标签页中只运行一轮实验。浏览器之间不共享记录；清除网站数据会删除本地记录，请导出报告及数据集备份。已运行的本机 Node 记录不会自动迁移到线上域名。

```sh
npm ci
npm run build:cloudflare
npm run dev:cloudflare
npm run deploy:dry
npm run deploy
```

Wrangler 配置绑定 `autoeval.zhangmin.name`，仅发布 `cloud-dist/` 的公开资源。默认关闭 workers.dev 和版本预览。公网不接受数据/任务写入 API，也不能通过 URL 访问浏览器内的实验记录。`npm run types:cloudflare` 可重新生成当前配置的 Worker 类型。
