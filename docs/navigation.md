# 网站导航维护与验收

站点清单唯一来源：`src/data/sites.json`。主页导航、终端 `sites` 输出、独立子站的“更多作品”使用这份清单。中国政策雷达已纳入；GitHub 源码链接保留新标签页，个人网站间跳转统一在当前标签页打开。

修改清单或导航样式后，在 portfolio 根目录运行：

```sh
npm run sync:navigation
npm run build
node scripts/navigation/sync-sites.mjs --check
node scripts/sync-panoramas.mjs --check
npm test
```

`npm run build` 同时刷新各子站已提交的导航片段、评测探索局和全景图快照。子站仍按各自 README 构建和部署；主页部署不等于独立子站部署。导航使用普通链接和原生 details，不依赖远端脚本，不改变各站的 CSP。

评测前沿在 `zhangmin510/AIHOT` 的 `eval-frontier` 分支中。两份 checkout 同时可用时，在 portfolio 根目录同步：

```sh
node scripts/navigation/sync-sites.mjs --frontier /workspace/AIHOT
node scripts/navigation/sync-sites.mjs --check --frontier /workspace/AIHOT
```

它更新评测前沿自己的导航组件和 CSS，不要求运行时访问 portfolio。该站应单独构建、测试和部署。`docs/eval-frontier-navigation.patch` 保存了本次跨仓库改动，供其他尚未应用修改的 eval-frontier checkout 审阅或使用 `git apply` 应用；当前 /workspace/AIHOT 已应用，不要重复应用。

全景图的导航在同步脚本中统一加入。恢复发布快照时先去除生成导航，再验证原始内容 SHA-256；不把修改后的校验值当作原始来源。iframe 图谱的导航位于外层页面。评测探索局共用相同生成器，保留原有页脚回链。

目录使用 `q` 和 `category` URL 参数保存搜索、分类；sessionStorage 仅保存同一标签页的最近筛选和滚动位置。复制带参数链接可以分享筛选。禁用存储仍能筛选和分享 URL。

发布前验收：

- 从分享链接直接打开任意全景图或独立子站，确认“个人主页”可用；全景图还有“全部知识地图”。
- 桌面与手机检查菜单不越界、不遮挡原有工具；Logo 仍返回子站自身首页。
- 目录筛选后打开详情，再用目录链接返回，保留筛选和位置；浏览器前进后退正常。
- AutoEval 运行浏览器实验时离开页面触发浏览器提醒；栈城日常未保存时返回主页有确认。
- 分别发布主页和相关独立子站后，核验线上响应、跳转和缓存。网络策略拦截不能当作线上故障。

浏览器回归脚本：`scripts/navigation/browser-smoke.mjs`。需要 Playwright 与 Chromium；可通过 `PLAYWRIGHT_MODULE` 指定已安装的模块路径，通过 `CHROMIUM_PATH` 指定浏览器。它读取本地服务，不访问线上生产站点：

- portfolio/public 静态服务：8090（支持目录 index.html）
- EvalTube：4317；EvalPapers：4322；Time Capsule：4323；AutoEval：4324
- 政策雷达 public 静态服务：8091；权重实验室 explorer 静态服务：8092
- 栈城日常 Vite：5178；评测前沿 web：3000（API：3001）

脚本覆盖筛选和滚动恢复、桌面/手机回链与菜单边界、游戏创建与游玩入口，以及评测前沿多个路由。权重实验室的导航验收不要求下载模型；它不替代该站完整数据和模型构建验证。

## 本次验证记录（2026-11-12）

- Portfolio：71 项测试通过；TypeScript、客户端/SSR 构建与预渲染通过。
- 导航同步与 17 张全景图来源校验通过；重复生成未累积导航或修改原始来源校验值。
- 栈城日常：47 项 Vitest 与 7 项反馈测试通过，构建及单文件版本生成通过。
- EvalTube 26、EvalPapers 12、Time Capsule 15、AutoEval 19 项测试通过。各站资源构建通过，AutoEval 浏览器版本构建通过；政策雷达 Wrangler dry-run 通过。
- 评测前沿：全仓库类型检查、Web 构建、35 项前端测试和站点 smoke 均通过。临时 PostgreSQL 17 测试库迁移成功；后端全量最终一次为 185/186 通过，report-candidates 的发布日期边界测试失败。未修改基线中单独运行该文件 4/4 通过；此前也观察到翻译恢复相关测试的间歇性失败，其基线单独运行 5/5 通过。没有修改后端或放宽断言，也不将后端全量报告为通过。测试使用本地假接口，不使用生产凭据。
- Chromium：390px/1366px 下验证回链、菜单边界与可点击性、iframe 外层导航、目录往返筛选/滚动恢复、游戏创建/游玩入口及评测前沿多个路由。菜单也检查了未被父容器裁切。
- 权重实验室仅验证静态导航，未下载 checkpoint 或重跑模型与完整数据构建。线上访问受环境网络策略限制，本次没有线上发布或线上跳转验收。
