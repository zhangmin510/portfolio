# Terminal Portfolio

终端风格的个人作品集网站，基于 React + TypeScript + Vite 构建。

## 预览

```
  ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
     ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
```

## 功能特性

- 语义化、可预渲染的个人介绍、代表项目与联系入口
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

## 自定义内容

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
