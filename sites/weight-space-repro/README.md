# 在 Mac 本地复现 Weight-Space Programming

线上入口见 [Qwen 权重实验室](https://weights.zhangmin.name/)。

对应新闻是 MIT CSAIL 于 **2026-11-02** 发布的 [Sparks of Weight-Space Programming](https://rikiyat.github.io/blog/weight-space-programming/)，这里复现其中 **Experiment 8 / Qwen3.5-0.8B / p50c**。

原实验让 GPT-6 Astra 通过 Python 查看权重、读取激活和试运行，随后直接编辑小模型的参数，不使用反向传播和训练。它主要修复了 thinking 模式下的推理循环。这不是把 8 亿参数作为文字全部放进一次提示词：实验允许工具和最多 50 批前向调用。

## 本目录完成什么

1. 下载固定 revision 的官方 BF16 基座，保留原始权重。
2. 重放作者发布的精确补丁，生成独立的修改版 checkpoint。
3. 检查所有张量，证明只有两张量中的指定数值发生变化。
4. 用未量化模型在 Apple Silicon 的 MLX 后端运行相同问题，保存配对输出与评分。

**这是补丁重放及本地效果验证。** 没有重新执行“让大模型从零找到补丁”的搜索，也没有运行原文的全量 MATH-500 评测。原搜索的代理 harness 未公开；作者记录 p50c 搜索耗时约 20.3 小时。

## 环境与运行

实验使用 Apple M1 Pro、16 GB 内存和 Python 3.12。`requirements.lock` 固定 MLX 运行环境。安装 [uv](https://docs.astral.sh/uv/) 和支持 sparse-checkout 的 Git。从 Portfolio 仓库根目录进入 `sites/weight-space-repro`，以下命令均在权重实验室目录执行。请为原始和编辑版模型、下载缓存及输出预留约 5 GB 磁盘空间。

首次安装和运行：

```bash
bash scripts/setup.sh
.venv/bin/python scripts/prepare.py
.venv/bin/python scripts/evaluate_mlx.py --max-tokens 2048 --output results/smoke
# 针对预先固定的第一题，额外检查较长预算下的行为
.venv/bin/python scripts/evaluate_mlx.py --limit 1 --max-tokens 8192 --output results/budget8192
.venv/bin/python scripts/summarize.py
```

恢复中断的推理：

```bash
.venv/bin/python scripts/evaluate_mlx.py --max-tokens 2048 --output results/smoke --resume
```

只做权重校验或短演示：

```bash
# 基座已经下载后，无需网络重建并校验
.venv/bin/python scripts/prepare.py --offline

# 另存一次短演示；同一个结果目录只接受完全一致的配置续跑
.venv/bin/python scripts/evaluate_mlx.py --limit 2 --max-tokens 512 --output results/quick
```

结果文件：

- `results/weight_verification.json`：固定版本、补丁哈希、所有张量校验、修改位置。
- `results/smoke/results.json`：完整提示词、模型输出、参考答案、评分、结束原因、token 数、耗时、环境。
- `results/smoke/report.md`：中文可读对比及逐题完整输出。
- `REPORT.md`：本次实际运行结论。

## 从公开记录重建线上站点

此路径使用 Python 3.12、`curl` 和 `requirements-build.lock` 的 CPU 依赖。模型补丁和权重统计在本地重算，推理和评测面板读取已发布的实测记录。`data/published-reference.json` 固定七个公开文件的 URL、字节数和 SHA256，其中包括完整推理 JSON、NPZ 数组及两组评测结果。恢复脚本核对下载与解压后的哈希，已有内容不同时停止。发布记录不可用时，可以按上节重新运行两组评测，再运行 `scripts/trace_inference.py`。

```bash
bash scripts/setup.sh --build-only
.venv/bin/python scripts/prepare.py
.venv/bin/python scripts/fetch_reference.py
.venv/bin/python scripts/export_visual_data.py --full
.venv/bin/python scripts/build_cloudflare.py
```

`prepare.py` 从固定 Hugging Face revision 下载单个约 1.75 GB 的 checkpoint 和配套文件，校验完整基座 SHA256，再从固定 Git 提交重放 p50c 补丁。`build_cloudflare.py` 需要同一对 checkpoint 的完整统计、模型清单和上述实测记录。它生成 `cloudflare/dist/`，包括两份稀疏补丁、全部 488 个张量的直方图，以及词表、配置、实验和推理数据。线上 Worker 通过固定 Hugging Face revision 按范围读取基座文件，并提供修改版权重流和单张量下载。

使用 Node.js 22 或更高版本和 Wrangler 4.158.0 预览构建。该版本支持 `cloudflare/wrangler.jsonc` 中的生产兼容日期。配置中的自定义域名需要对应 Cloudflare 账号的权限。

```bash
npx --yes wrangler@4.158.0 deploy --dry-run --config cloudflare/wrangler.jsonc
npx --yes wrangler@4.158.0 dev --config cloudflare/wrangler.jsonc --port 8787
# 发布到配置所指定的域名
npx --yes wrangler@4.158.0 deploy --config cloudflare/wrangler.jsonc
```

Git 中保留源码、锁文件、题目、验证记录清单和结果报告。`models/`、`upstream/`、`results/`、`.venv/`、缓存和 `cloudflare/dist/` 由上述命令恢复或生成。

## 精确修改了什么

模型：`Qwen/Qwen3.5-0.8B`，revision：

```text
2fc06364715b967f1860aea9cf38778875588b17
```

实验日志固定到 commit：

```text
4d09ba6d6a7e891dd8063974dfe81b3d78e3494f
```

| 张量（下标从 0 开始） | 形状 | 修改列数 | BF16 实际差异数 |
|---|---|---:|---:|
| `model.language_model.layers.15.mlp.down_proj.weight` | 1024 × 3584 | 64 | 65,260 |
| `model.language_model.layers.19.mlp.down_proj.weight` | 1024 × 3584 | 64 | 64,928 |
| 合计 | | 128 | 130,188 |

新闻中的 131,072 是触及的参数数：`2 × 64 × 1024`；BF16 舍入后实际改变 130,188 个数值。每层补丁的思路为：

```text
W' = W0 - 6 * outer(u, mask64 * (u @ W0))
```

`u` 是从正常推理和重复推理的激活差异中提取的方向；`mask64` 选择该层最相关的 64 个输出列。这里使用作者公开的 `edit.npz` 逐值重建，避免重新计算方向和舍入造成差异。

`scripts/prepare.py` 调用作者的 `apply_edit.rebuild`；在复制的原权重文件中只覆盖目标张量对应的数据区域，再读取文件验证目标 SHA256、差异数和全部其他张量。它不调用优化器，也没有梯度更新。

## 全部权重与模型信息浏览

```bash
# 重新扫描全部参数并导出完整统计/清单（当前已经生成）
.venv/bin/python scripts/export_visual_data.py --full
# 启动只读本地浏览器工具
.venv/bin/python scripts/serve_explorer.py --port 18767
```

打开 [本地模型探索器](http://127.0.0.1:18767)。它提供全部 488 个张量的目录、统计、任意位置的数值切片、基座/编辑版/差值、原始数值位模式与数据导出，以及完整配置、词表、特殊 token、聊天模板、官方模型卡、许可证和实验记录。

完整 checkpoint 实际包含 **873,438,784 个存储元素**：文本 752,393,024，视觉塔 100,592,896，MTP 附加预测模块 20,452,864。452 张量为 BF16，36 张量为 F32，不能把整个文件视为仅有文本权重或纯 BF16。

`results/tensor-statistics.json` 对全部元素进行了逐值扫描，保存每张量 min/max/mean/std/L2、零值及非有限数计数、原始字节 SHA256；`results/model-inventory.json` 保存完整文件头、配置原文、tokenizer 元数据、模板原文和来源。全部原始权重、完整词表和 BPE merges 保留在原文件，可按需读取与导出。热力图明确列出实际显示的行列索引，不把采样窗口当作全矩阵。

发行文件中未包含的训练信息或神经元语义，会标为未提供或未验证；模型名称中的 0.8B、配置词表行数与 tokenizer 实际定义数也分别显示。

## 推理计算过程示例

探索器中的“推理过程”使用原始模型真实计算：`1 + 1 = ? Reply with only the number.`。关闭显式 thinking，使用贪心选择；第一步输出 `2`，第二步输出结束符，自然结束。可逐步查看输入 token、Embedding、24 层主干、最终 RMSNorm、共享词嵌入投影、完整词表 softmax 后的 Top 10 概率，以及第 15 层 MLP 的实际矩阵运算。

```bash
.venv/bin/python scripts/trace_inference.py
```

`results/inference-trace.json` 保存原始数值记录与采集范围，包括每层最后输入位置的完整 1,024 维向量。`results/inference-arrays.npz` 另存全部 prompt embeddings、每步完整 248,320 维 logits / softmax 概率和各层向量，共 101 个数组；页面显示 8 维预览，完整数据可下载。

每一步展示的是“已输入位置的向量 → 下一个 token 预测”；生成的 token 在下一步才接回输入。这里记录的是数值计算，不将中间向量解释为模型的自然语言思考。采集器已与未插桩的首步计算比对，logits 最大绝对差为 0。

## 如何解释本地推理结果

默认数据是预先写好的 10 道手工数值题，每题每模型采样一次，thinking 开启。采样参数为 temperature=0.6、top_k=20、top_p=0.95、presence_penalty=1.5。后者覆盖全部已生成 token；脚本没有使用 MLX 默认的短窗口 presence penalty。

本地预算默认每题 2,048 新 tokens，原实验是 32,768；原实验使用 vLLM，且 MATH-500 每题采样 4 次。MLX 的内核、浮点行为和随机采样均可能不同，不能用本地少量题的正确率推算论文分数，也不能把耗尽预算直接等同于无限循环。

脚本主评分只在 `</think>` 后寻找最后一个完整 `\boxed{}`，用精确数值/分数比较参考答案；还保存全文 boxed 的宽松分数便于检查。所有截断样本均计入分母。它是透明的简单数值评分器，不替代原实验的 math-verify。

MLX 加载原始 BF16 checkpoint，没有进行 4-bit/8-bit 量化。运行时会按 MLX 模型实现调整部分参数布局；磁盘上权重补丁的位级校验与跨后端输出复现是两个不同层面的结论。

## 原始来源与许可

- [作者原文](https://rikiyat.github.io/blog/weight-space-programming/)
- [官方完整日志](https://github.com/RikiyaT/lm_understand-logs)
- [Experiment 8 说明与协议](https://github.com/RikiyaT/lm_understand-logs/blob/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp8_math/README.md)
- [官方补丁重建脚本](https://github.com/RikiyaT/lm_understand-logs/blob/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp8_math/code/apply_edit.py)
- [官方 p50c 精确补丁](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp8_math/runs/p50c/edit)
- [原始模型](https://huggingface.co/Qwen/Qwen3.5-0.8B/tree/2fc06364715b967f1860aea9cf38778875588b17)

上游脚本为 MIT 许可，实验日志/数据/网络为 CC BY 4.0；模型及第三方数据遵循各自许可。下载的上游仓库保留原许可证，模型和上游资料未复制为本项目原创内容。
