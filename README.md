# Terminal Portfolio

终端风格的个人作品集与交互式全景图合集，基于 React + TypeScript + Vite 构建。

- 个人主页：[zhangmin.name](https://zhangmin.name/)
- 全景图目录：[zhangmin.name/panoramas/](https://zhangmin.name/panoramas/)

## 功能特性

- 语义化、可预渲染的个人介绍、代表项目与联系入口
- 首页「全景图」导航，连接 15 张独立目录发布的交互图谱
- 全景图目录支持主题筛选、关键词搜索与手机浏览
- 真实表单驱动的命令行交互，兼容键盘、触屏与屏幕阅读器
- 命令历史 (↑/↓ 键)
- Tab 自动补全
- 支持多种命令：`about`、`skills`、`projects`、`contact`、`neofetch` 等
- 可关闭并记忆偏好的机械键盘按键音效（Web Audio API）
- `hello world` 彩蛋：ASCII Art 逐行打字动画
- 可选的键盘 & 鼠标可视化，仅在精细指针桌面设备挂载
- 支持 `prefers-reduced-motion`
- 完整的 Open Graph、JSON-LD、robots、sitemap 与静态 404
- CSP、安全响应头和哈希资源长期缓存

## 全景图目录

内容分为模型与训练、Agent 与搜索、评测与可靠性、行业与基础设施、生活与成长五个方向。
以下目录均位于 `/panoramas/` 下，可直接访问或分享。

| 全景图 | 目录链接 |
| --- | --- |
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
  <主题>/index.html          # 15 个独立页面的发布快照
  vendor/                    # 固定版本的 Chart.js 与 html-to-image
scripts/panoramas.json       # 标题、分类、原始文件映射与校验值
scripts/sync-panoramas.mjs    # 同步原始页面、生成目录并校验快照
src/data/portfolio.ts        # 个人资料、能力方向与项目
src/commands/index.ts        # 终端命令注册
worker/index.js              # Cloudflare 安全头、缓存与 404
```

## 自定义内容

### 全景图

`public/panoramas/` 中的发布快照和脚本已提交到仓库，`npm run build` 直接使用这些文件。
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
