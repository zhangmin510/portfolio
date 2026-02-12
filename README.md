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
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 部署

### Vercel 部署

项目已配置 Vercel，支持一键部署：

```bash
# 安装 Vercel CLI（首次使用）
npm i -g vercel

# 部署到预览环境
vercel

# 部署到生产环境
vercel --prod
```

或者直接推送代码到 Git 仓库，在 Vercel 控制台关联仓库后，每次推送会自动部署。

**生产环境地址：** https://learn-iota-two.vercel.app

### 其他平台

项目构建产物在 `dist` 目录，可部署到任何静态托管平台：
- Netlify：构建命令 `npm run build`，发布目录 `dist`
- GitHub Pages：使用 `vite build` 构建后推送 `dist` 目录到 `gh-pages` 分支
- 自建服务器：将 `dist` 目录内容部署到 Web 服务器

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
