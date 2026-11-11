# 中国政策雷达

浏览历次政策与会议信号，结合中国政府网公开列表查看近期更新。[线上站点](https://zhengce-radar.zhangmin.workers.dev/)

在 `sites/policy-radar-cn` 中运行以下命令。建议使用 Node.js 22 或更新版本。

```sh
npm ci
npm run typecheck
npm run dev -- --ip 127.0.0.1
```

`npm run typecheck` 先用 Wrangler 生成 Worker 类型，再执行 TypeScript 检查。`npm run deploy:dry` 可在本地检查发布包。`wrangler.jsonc` 保留 Worker 名称 `zhengce-radar` 和静态资源绑定，Wrangler 使用你自己的登录账号。

`/api/data` 返回 `src/data.ts` 中带来源的历史资料。`/api/live` 在运行时读取中国政府网的公开要闻和政策列表，并使用 Cloudflare Cache API 缓存响应。实时列表依赖上游连通性，构建和类型检查不需要访问上游。此仓库不含账号密钥或实时抓取快照。
