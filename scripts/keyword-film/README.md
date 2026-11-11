# 关键词短片制作源文件

从 `src/data/portfolio.ts` 中的 `YEARLY_KEYWORDS` 读取六组原始数据，生成 50 秒横屏暖纸色动态图形视频。

需要 Python 3、Pillow、FFmpeg，以及 macOS 系统的 Songti、Baskerville、Avenir Next 字体。音频合成仅使用 Python 标准库。

在 portfolio 项目根目录运行：

```sh
python3 scripts/keyword-film/compose_audio.py
python3 scripts/keyword-film/render_film.py --preview
python3 scripts/keyword-film/render_film.py
```

其他平台可用 `--font-dir /path/to/fonts` 指向含上述字体的目录，使用者需自行拥有相应字体许可。视频本身的播放不依赖这些字体。

- 最终文件输出到 `public/keyword-film/`。
- 临时 WAV、分镜预览与日志输出到被 Git 忽略的 `.film-work/`。
- `--preview` 只输出封面、分镜、字幕、manifest。
- `--silent` 导出不含音轨的 MP4。
- 字幕、章节时间与片长保持固定；如新增年度，需同步设计时间轴、播放器章节及片长。

H.264 high / yuv420p + AAC，使用 `faststart` 将 MP4 索引置于文件开头，适用于现代网页播放器。分镜中的插画均由本项目代码绘制，音乐由本项目合成器生成，无外部素材下载。
