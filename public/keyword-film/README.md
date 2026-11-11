# 年岁有词 · 把日子，写成关键词。

50 秒温暖回顾短片，1920×1080、30 fps、H.264 + AAC，约 6.1 MiB。

## 播放与部署

把整个 `keyword-film` 目录上传到任意静态网站即可。入口为 `index.html`，与 MP4、封面、字幕、CSS、JS 保持相同相对位置。视频没有外部素材或网络依赖。

在此项目中运行 `npm run dev` 后，开发预览入口为 `/keyword-film/index.html`；生产构建后的静态入口为 `/keyword-film/`。网站终端输入 `keyword`，即可看到播放器链接。

网页中也可以直接嵌入：

```html
<video class="keyword-film" controls playsinline preload="metadata"
  poster="/keyword-film/poster.jpg" width="1920" height="1080">
  <source src="/keyword-film/keywords-2020-2026.mp4" type="video/mp4">
  <track kind="captions" src="/keyword-film/captions.vtt" srclang="zh" label="中文">
</video>
```

在网站 CSS 中加入 `.keyword-film { display: block; width: 100%; height: auto; }`。

使用原生 video 嵌入；当前主站禁止 iframe。默认由访客点击播放，有声音，不会强制自动播放。若仅作静音背景，可添加 `autoplay muted loop`；浏览器通常只允许静音自动播放。

## 内容来源

2026-11-11 核对了 https://zhangmin.name/ 的公开页面脚本，与项目 `src/data/portfolio.ts` 一致：

| 年份 | 原始关键词 | 视频开始 |
| --- | --- | --- |
| 2020 | 家 7 而立 | 00:05 |
| 2021 | 家 做时间的朋友 而立 | 00:11 |
| 2022 | 家 突破 而立 | 00:17 |
| 2024 | 真行 传承 节奏 | 00:23 |
| 2025 | 沟通 成长 Agent | 00:29 |
| 2026 | 认知 Agent MVP | 00:35 |

2023 年没有原始记录；「真行」与数字「7」原样保留。画面中的房屋、时钟、门、树、连接与方块为原创象征性插画，不是现实经历的照片或事实陈述。片头与片尾为创作性文案，片尾「行胜于言」来自主页座右铭。

配乐为原创程序合成的轻柔钢琴音色与暖 Pad，无人声、无外部录音。字体由本机系统字体栅格化进视频，未分发字体文件。

`manifest.json` 包含分章与来源信息，`captions.vtt` 为可选中文字幕。
