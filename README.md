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

- 命令行交互界面，页面加载后自动聚焦，直接输入即可
- 命令历史 (↑/↓ 键)
- Tab 自动补全
- 支持多种命令：`about`、`skills`、`projects`、`contact`、`neofetch` 等
- 机械键盘按键音效（Web Audio API）
- `hello world` 彩蛋：ASCII Art 逐行打字动画
- 右下角半透明虚拟键盘 & 鼠标可视化，实时响应物理输入
- 自定义块状闪烁光标，跟随输入内容移动

## 快速开始

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 使用 Cloudflare Pages 的本地运行环境预览
npm run preview:cloudflare
```

## 部署

### Cloudflare Pages（推荐）

项目已经包含 Cloudflare Pages 配置：

- 构建命令：`npm run build`
- 构建输出目录：`dist`
- Node.js：`22.16.0`
- Pages 项目名：`terminal-portfolio`

Cloudflare Pages 会把没有匹配到静态文件的页面请求交给根目录的
`index.html`，因此这个 React 单页应用不需要额外的 `_redirects` 规则。

#### 方式一：连接 Git 仓库自动部署

1. 在 Cloudflare 控制台进入 **Workers & Pages**。
2. 选择 **Create application > Pages > Connect to Git**。
3. 选择当前仓库，生产分支设置为 `main`。
4. 项目名填写 `terminal-portfolio`，与 `wrangler.jsonc` 保持一致。
5. Framework preset 选择 **React (Vite)**。
6. Build command 填写 `npm run build`。
7. Build output directory 填写 `dist`。
8. 保存并部署。以后每次推送到 `main` 都会自动更新生产站点。

#### 方式二：从命令行直接部署

首次部署：

```bash
npm ci
npx wrangler login
npx wrangler pages project create terminal-portfolio --production-branch main
npm run deploy:cloudflare
```

之后更新站点只需：

```bash
npm run deploy:cloudflare
```

#### 方式三：在控制台直接上传

运行 `npm run build`，然后在 Cloudflare Pages 中选择 **Direct Upload**，
上传生成的 `dist` 文件夹。

#### 绑定自己的域名

部署完成后，打开 Pages 项目的 **Custom domains > Set up a domain**，
添加根域名或子域名。域名已经由 Cloudflare 管理时，所需 DNS 记录和
HTTPS 证书会自动配置。

如果 Cloudflare 中已经创建了其他名称的 Pages 项目，请同步修改
`wrangler.jsonc` 中的 `name`，再运行部署命令。

### Vercel（保留兼容）

原有 `vercel.json` 仍然保留，因此项目也可以继续部署到 Vercel：

```bash
npx vercel
npx vercel --prod
```

## 自定义内容

编辑 `src/commands/index.ts` 中的常量来自定义个人信息：

- `ABOUT` - 个人介绍
- `SKILLS` - 技术栈
- `PROJECTS` - 项目经历
- `CONTACT` - 联系方式

## 技术栈

- React 18
- TypeScript
- Vite

## License

MIT
