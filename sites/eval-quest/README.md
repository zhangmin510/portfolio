# 评测探索局 · EVAL QUEST

[打开互动学习站](https://zhangmin.name/panoramas/eval-quest/) · [个人主页](https://zhangmin.name/)

从度量衡到 AI 智能体的游戏式知识地图：4 个区域、12 关、24 道情境题、4 个实验，以及 18 篇书稿与 14 幅原创图。

## 统一管理与发布

本目录与个人主页共用 `zhangmin510/portfolio` 仓库。以 `/panoramas/eval-quest/` 子路径发布到现有 `terminal-portfolio` Worker，不创建第二个仓库、Worker 或域名。

| 文件 | 职责 |
| --- | --- |
| `template.html` | 页面布局、主题与导出工具壳 |
| `styles.css` | 知识地图与移动端样式 |
| `app.js` | 关卡、实验、存档、笔记及章节深链接 |
| `data.json` | 关卡内容、公开书稿快照、公式、嵌入式 SVG、术语及原稿文件校验值 |
| `build.mjs` | 无第三方依赖的构建与公开边界检查 |
| `../../public/panoramas/eval-quest/index.html` | 随仓库提交的可发布单页快照 |

从仓库根目录运行：

```bash
npm ci
npm run build:eval-quest
npm run sync:panoramas
npm run check
node sites/eval-quest/build.mjs --check
node scripts/sync-panoramas.mjs --check
npx wrangler deploy --dry-run
```

`npm run build` 自动重建此页面。修改本目录后，先构建，再同步目录清单与校验值，一起提交源码、清单和发布快照。构建只读取本仓库，不依赖 Obsidian、私人笔记目录、临时文件或外部模型/API。其他全景图按原有快照机制管理。

主页入口维护于 `src/data/portfolio.ts` 的 `WEBSITES`，知识地图条目维护于 `scripts/panoramas.json`，搜索引擎入口维护于 `public/sitemap.xml`。

## 内容与隐私边界

- 本页是书稿 v0.3 的**教学草稿公开衍生版**，不是专家审定本；资料截止原稿核验日 2026-11-06。网站接入日期为 2026-11-11，不代表研究事实重新核验。
- 保留文献链接、证据身份、虚构案例和模拟数字标注；不把研究结果包装为独立复现，也不提供医疗、投资或合规认证。
- 已去掉本机路径、私人笔记链接和本地应用跳转；原始笔记及其审核/公开状态没有修改。
- `SOURCE_MANIFEST` 只记录原稿文件名及 SHA-256，标识编辑来源，不是公开版内容校验值或事实审核证明。公开快照校验值在全景图清单中。
- `data.json` 的书稿是渲染快照，原稿后续修改不会自动同步。更新时应重新审查公开内容和引用边界，不能直接复制整个笔记目录。
- 不含账号、服务器存储、统计埋点或上传接口。进度和摘记仅保存在当前浏览器的 localStorage；注意该存储与同域页面共享安全边界。

## 学习进度与离线使用

本地 HTML 与线上域名之间不会自动迁移进度。先在原页面的“学习护照”导出 JSON 存档，再在此页导入；导入前会确认是否替换现有进度。

保存页面 HTML 后，地图、课程、全文、公式和实验仍可离线使用。PNG 截图工具引用本站固定版本 `html-to-image`，离线单页中不可用时可改用打印/PDF。文献外链需要联网。导出的 Markdown 笔记包含可分享的 `#book-XX` 章节链接。

修改互动行为后，至少复查：全部关卡和正确答案、4 个实验、存档导入导出、章节阅读、320/375/768/1440 px 布局、深浅主题、浏览器存储禁用和离线加载。根目录单元测试同时验证发布快照、隐私边界、导航与 CSP。
