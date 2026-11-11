# 本地复现结果

运行完成：2026-11-07 02:26 +08。

**官方 p50c 权重补丁已精确重放并校验；本地 10 题配对演示中，正确提交最终答案从 3/10 变为 1/10，耗尽预算从 7 题变为 9 题。**

这是对 MIT CSAIL 2026-11-02 发布的 [Sparks of Weight-Space Programming](https://rikiyat.github.io/blog/weight-space-programming/) Experiment 8 的补丁重放和本地推理验证。没有重新运行大模型从零发现补丁的搜索。

## 权重文件验证

原模型：`Qwen/Qwen3.5-0.8B`，revision `2fc06364715b967f1860aea9cf38778875588b17`。

逐张量验证全部 488 个张量，恰好 2 个发生变化；其余 486 个保持相同。BF16 实际改变 130,188 个数值，两张量的原始及编辑后 SHA256 均匹配作者清单。

补丁覆盖第 15、19 层 MLP 的 down_proj.weight，各 64 列。新闻中的 131,072 是触及数，实际 BF16 差异是 130,188。本地按精确的 752,393,024 个文本权重计算，变化占 0.017303%；原文另报告约 0.016%，这里保留实际计数与分母便于核对。

完整原始 checkpoint SHA256：`04b1c301231dd422b8860db31311ab2721511346a32cb1e079c4c4e5f1fe4696`，已核对固定版本的 HF LFS 哈希。

完整修改版 checkpoint SHA256：`bd5c223dc7d0ed48a6857f798a94da6ec46c40b9ff4e7bc31872dba10f943ae5`。

重放中没有训练、优化器或反向传播；原始文件保留，修改版单独保存。

## 本机配对推理

Apple M1 Pro / 16GB，Python 3.12，MLX 未量化 BF16 加载。预先固定 10 道手工数值题，每模型每题一次采样，thinking 开启，最多 2,048 新 tokens。同题同 seed；temperature=0.6、top_k=20、top_p=0.95，presence_penalty=1.5 覆盖全部已生成历史。

| 指标 | 原模型 | 修改版 |
|---|---:|---:|
| 正确提交最终答案 | 3/10 | 1/10 |
| 自然结束 | 3 | 1 |
| 达到 token 上限 | 7 | 9 |
| 平均生成 tokens | 1804.4 | 1927.5 |
| 逐题推理耗时合计（秒） | 239.0 | 283.2 |

由错变对 0 题，由对变错 2 题。以下列出所有题目，没有按结果筛选：

| 题目 ID | 参考答案 | 原模型正确 | 原模型 tokens | 修改版正确 | 修改版 tokens |
|---|---:|---|---:|---|---:|
| arithmetic | 391 | 否 | 2048 | 否 | 2048 |
| linear_equation | 8 | 是 | 851 | 是 | 843 |
| triangle | 13 | 是 | 1620 | 否 | 2048 |
| remainder | 1 | 否 | 2048 | 否 | 2048 |
| coin_probability | 3/8 | 否 | 2048 | 否 | 2048 |
| digit_count | 19 | 否 | 2048 | 否 | 2048 |
| factorial_zeros | 24 | 否 | 2048 | 否 | 2048 |
| word_problem | 7 | 是 | 1237 | 否 | 2048 |
| consecutive_sum | 26 | 否 | 2048 | 否 | 2048 |
| quadratic_roots | 13 | 否 | 2048 | 否 | 2048 |

## 单题预算诊断

因为短预算下仍有大量未完成输出，额外使用预先固定的第一题和同一 seed，把两版生成上限都提高到 8,192 tokens。这是一题诊断，不并入上面 10 题的统计，也不能用于估计整体准确率。

| 模型 | 正确提交最终答案 | 生成 tokens | 结束原因 |
|---|---|---:|---|
| base | 否 | 8192 | length |
| edited | 否 | 8192 | length |

完整输出见 `results/budget8192/report.md`。

## 结论的边界

评分只在 `</think>` 后提取最后一个完整 boxed 数值或分数，所有截断样本计入分母；全文 boxed 的宽松评分也保留在 JSON 中。耗尽预算表示本次未完成，不能单凭这个指标证明无限循环。

该演示使用少量手工题、短 token 预算和 MLX 后端；原实验使用 vLLM、32,768 token 预算，MATH-500 每题 4 次采样，不能将这里的正确率当作其 48.1% 指标的复现。即使采样参数和 seed 相同，跨后端浮点计算与随机序列也不等价。

权重补丁的位级一致性已经验证。重新发现补丁的代理 harness 未公开，原始搜索耗时约 20.3 小时；本次没有执行这部分。

完整逐题输出见 `results/smoke/report.md` 和 `results/smoke/results.json`；权重审计见 `results/weight_verification.json`，重新运行方法见 `README.md`。

## 再运行

```bash
# 在权重实验室目录执行
.venv/bin/python scripts/evaluate_mlx.py --max-tokens 2048 --output results/another-run
```
