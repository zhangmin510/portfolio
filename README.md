# Terminal Portfolio

终端风格的个人作品集与交互式全景图合集，基于 React + TypeScript + Vite 构建。

- 个人主页：[zhangmin.name](https://zhangmin.name/)
- 全景图目录：[zhangmin.name/panoramas/](https://zhangmin.name/panoramas/)

## 功能特性

- 简洁的单栏终端主页，保留个人介绍、命令输入和轻量导航
- 首页直接提供九个网站入口，`sites` / `websites` 命令可查看介绍，`cd sites` 可按目录浏览
- `panoramas` 命令与全景图入口，连接 17 张独立目录发布的交互图谱
- 评测探索局：12 关游戏式知识地图、24 道情境挑战、4 个实验与全书阅读，进度本地保存
- 全景图目录支持主题筛选、关键词搜索与手机浏览
- 真实表单驱动的命令行交互，兼容键盘、触屏与屏幕阅读器
- 命令历史 (↑/↓ 键)
- Tab 自动补全
- 支持目录切换、路径补全及 `pwd`、`ls`、`cat`、`history` 等内容浏览命令
- 支持 Ctrl+C 中断、Ctrl+L 清屏和常用终端行编辑快捷键
- 支持多种命令：`about`、`skills`、`projects`、`contact`、`neofetch` 等
- 可关闭并记忆偏好的机械键盘按键音效（Web Audio API）
- `hello world` 彩蛋：ASCII Art 逐行打字动画
- 键盘 & 鼠标可视化在桌面端默认显示，可通过 `keys:on/off` 开关并记住偏好
- 支持 `prefers-reduced-motion`
- 完整的 Open Graph、JSON-LD、robots、sitemap 与静态 404
- CSP、安全响应头和哈希资源长期缓存

## 终端交互

点击终端空白处开始输入，使用 `help` 查看命令。`projects` 显示三个精选项目，
`panoramas` 显示全景图与访问链接，也可以按目录浏览：

```text
ls
cd projects
cat obsidian-podium.md
cd ../panoramas
cat ai-subscription-token-atlas.html
cd ~
```

↑ / ↓ 浏览命令历史，Tab 补全命令或路径；Ctrl+C 取消当前输入，
Ctrl+L 清屏，Ctrl+A / E 移动到行首 / 行尾。页面内容以终端输出形式展示。

## 网站导航

| 网站 | 入口 |
| --- | --- |
| 全景图 · 知识地图 | [全景图总览](https://zhangmin.name/panoramas/) |
| 评测探索局 · 游戏式评测学习 | [进入知识远征](https://zhangmin.name/panoramas/eval-quest/) |
| 评测前沿 · 模型与 Agent 评测 | [b.zhangmin.name](https://b.zhangmin.name/) |
| EvalTube · AI 评测视频 | [evaltube.zhangmin.name](https://evaltube.zhangmin.name/) |
| EvalPapers · 评测论文 | [evalpapers.zhangmin.name](https://evalpapers.zhangmin.name/)（[备用入口](https://evalpapers.zhangmin.workers.dev/)） |
| AI Time Capsule · AI 历史档案 | [timecapsule.zhangmin.name](https://timecapsule.zhangmin.name/) |
| AutoEval · 检索实验 | [autoeval.zhangmin.name](https://autoeval.zhangmin.name/) |
| 栈城日常 · 程序员生活模拟 | [programmer-life.zhangmin.workers.dev](https://programmer-life.zhangmin.workers.dev/) |
| 权重实验室 · 模型权重与推理 | [weights.zhangmin.name](https://weights.zhangmin.name/) |

导航数据统一维护在 `src/data/portfolio.ts` 的 `WEBSITES`，同时用于首页链接、终端输出和虚拟目录。

八个子项目的源码与构建说明见[子站目录](sites/README.md)，其中评测探索局作为主页子路径发布，共用主页的 Cloudflare 部署。评测前沿的 Cloudflare 配置维护在 [AIHOT 的 `eval-frontier` 分支](https://github.com/zhangmin510/AIHOT/tree/eval-frontier/deploy/cloudflare)。

## 全景图目录

内容分为模型与训练、Agent 与搜索、评测与可靠性、行业与基础设施、生活与成长五个方向。
以下目录均位于 `/panoramas/` 下，可直接访问或分享。

| 全景图 | 目录链接 |
| --- | --- |
| 评测探索局：从度量衡到 AI 智能体 | [eval-quest/](https://zhangmin.name/panoramas/eval-quest/) |
| AI 订阅与 Token Plan 全景图 | [ai-subscription-token-atlas/](https://zhangmin.name/panoramas/ai-subscription-token-atlas/) |
| MiniMind × nanochat | [minimind-nanochat-panorama/](https://zhangmin.name/panoramas/minimind-nanochat-panorama/) |
| 成长花园：1—7 岁女孩成长全景 | [girl-growth-1-7/](https://zhangmin.name/panoramas/girl-growth-1-7/) |
| 视频生成模型全景图 | [video-generation-atlas/](https://zhangmin.name/panoramas/video-generation-atlas/) |
| 联网搜索全景 | [search-panorama/](https://zhangmin.name/panoramas/search-panorama/) |
| 联网搜索技术图谱 | [search-technology/](https://zhangmin.name/panoramas/search-technology/) |
| 联网搜索评测图谱 | [search-evaluation/](https://zhangmin.name/panoramas/search-evaluation/) |
| Agent 开发历史与趋势 | [agent-evolution-atlas/](https://zhangmin.name/panoramas/agent-evolution-atlas/) |
| 开源模型微调全景 | [open-model-finetuning-atlas/](https://zhangmin.name/panoramas/open-model-finetuning-atlas/) |
| 大模型蒸馏全景图 | [llm-distillation-atlas/](https://zhangmin.name/panoramas/llm-distillation-atlas/) |
| AI 评测历史与趋势 | [ai-evaluation-panorama/](https://zhangmin.name/panoramas/ai-evaluation-panorama/) |
| 全球 AI 算力中心全景 | [ai-compute-atlas/](https://zhangmin.name/panoramas/ai-compute-atlas/) |
| AI 公司全景图 | [ai-company-atlas/](https://zhangmin.name/panoramas/ai-company-atlas/) |
| 大模型全景图 | [llm-landscape-atlas/](https://zhangmin.name/panoramas/llm-landscape-atlas/) |
| 大模型训练交互图谱 | [llm-training-atlas/](https://zhangmin.name/panoramas/llm-training-atlas/) |
| AI 评测行业全景 | [ai-evaluation-atlas/](https://zhangmin.name/panoramas/ai-evaluation-atlas/) |

各页提供的工具有所不同；部分支持 PNG、HTML、CSV/JSON 导出或打印，具体以页面菜单为准。
HTML 下载会恢复固定版本的 CDN 脚本地址，便于保存后单独打开；外部脚本与字体仍需要网络。

## 快速开始

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行单元测试、类型检查与生产构建
npm run check

# 预览生产构建
npm run preview

# 使用 Cloudflare Workers 本地运行环境预览
npm run preview:cloudflare
```

## 部署

### Cloudflare Workers Static Assets（推荐）

项目已迁移到 Cloudflare Workers Static Assets：

- 构建命令：`npm run build`
- 部署命令：`npx wrangler deploy`
- Node.js：`22.16.0`
- Worker 名称：`terminal-portfolio`

`wrangler.jsonc` 中的 Worker 为静态资源补充安全头与缓存策略。
不存在的路径返回带自定义页面的真实 `404`，避免产生 soft 404。

#### 方式一：连接 Git 仓库自动部署

1. 在 Cloudflare 控制台进入 **Workers & Pages**。
2. 创建或打开 `terminal-portfolio` Worker，并连接当前 Git 仓库。
3. 选择当前仓库，生产分支设置为 `main`。
4. Build command 填写 `npm run build`。
5. Deploy command 填写 `npx wrangler deploy`。
6. Root directory 保持为空（仓库根目录就是项目目录）。
7. 保存并部署。以后每次推送到 `main` 都会自动更新生产站点。

#### 方式二：从命令行直接部署

```bash
npm ci
npx wrangler login
npm run deploy:cloudflare
```

本地使用 Cloudflare 运行环境预览：

```bash
npm run preview:cloudflare
```

#### 绑定自己的域名

部署完成后，打开 Worker 的 **Settings > Domains & Routes**，添加
Custom Domain。域名已经由 Cloudflare 管理时，所需 DNS 记录和 HTTPS
证书会自动配置。

如果 Cloudflare 中已经创建了其他名称的 Worker，请同步修改
`wrangler.jsonc` 中的 `name`，再运行部署命令。

### Vercel（保留兼容）

原有 `vercel.json` 仍然保留，因此项目也可以继续部署到 Vercel：

```bash
npx vercel
npx vercel --prod
```

当前 Vercel 配置沿用首页 CSP；如需在 Vercel 使用全景图交互，需为 `/panoramas/`
同步 `worker/index.js` 中的专用 CSP。

## 项目结构

```text
public/panoramas/
  index.html                 # 可搜索、可筛选的目录页
  <主题>/index.html          # 17 个独立页面的发布快照
  vendor/                    # 固定版本的 Chart.js 与 html-to-image
scripts/panoramas.json       # 标题、分类、原始文件映射与校验值
scripts/sync-panoramas.mjs    # 同步原始页面、生成目录并校验快照
sites/eval-quest/            # 评测探索局的便携源码、内容快照与构建脚本
src/data/portfolio.ts        # 个人资料、能力方向与项目
src/commands/index.ts        # 终端命令注册
worker/index.js              # Cloudflare 安全头、缓存与 404
```

## 自定义内容

### 全景图

`public/panoramas/` 中的发布快照和脚本已提交到仓库，`npm run build` 使用这些文件，并从仓库内源码重建评测探索局。
新克隆的仓库无需相邻的原始文件目录，也无需先运行同步命令，就能构建完整站点。

需要更新内容时，可编辑清单映射的原始页面：它们默认位于仓库旁的
`../html/` 和 `../girl-growth-1-7/`。标题、介绍、分类与目录维护在
`scripts/panoramas.json`。然后运行：

```bash
npm run sync:panoramas
node scripts/sync-panoramas.mjs --check
npm run check
```

同步命令生成目录与页面快照，并校验固定版本脚本。缺少原始目录时，会从已提交的
发布快照恢复内容并验证来源校验值；因此独立克隆中仍可更新目录信息或运行检查。
确认结果后，将清单、同步脚本与发布快照一起提交，再按上述部署流程发布。

Cloudflare Worker 为全景图 HTML 配置专用 CSP，支持页面内联交互、Google 字体
与搜索图谱的内嵌页面。Chart.js 和 html-to-image 从本站的 `vendor/` 目录加载。

### 评测探索局

编辑 [sites/eval-quest](sites/eval-quest/README.md) 中的页面、交互和公开内容数据，然后运行：

```bash
npm run build:eval-quest
npm run sync:panoramas
npm run check
```

这是教学草稿的公开衍生版，保留资料时效、引用与未完成专家审读的边界。构建不读取私人笔记库；发布版不含本机路径或 Obsidian 跳转。学习进度不会从本地文件自动迁移，可通过学习护照导出/导入 JSON 存档。

### 个人资料与命令

个人信息、能力方向和项目数据统一维护在
`src/data/portfolio.ts`。命令名称、别名、帮助文本与快捷入口统一维护在
`src/commands/index.ts`，避免多处定义产生偏差。

## 技术栈

- React 18
- TypeScript
- Vite 8
- Vitest
- Cloudflare Workers Static Assets

## License

MIT
