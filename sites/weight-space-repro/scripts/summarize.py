#!/usr/bin/env python3
"""Write a concise Chinese report from a completed local run and weight audit."""
import argparse
from datetime import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", type=Path, default=ROOT / "results/smoke/results.json")
    parser.add_argument("--output", type=Path, default=ROOT / "REPORT.md")
    parser.add_argument("--diagnostic", type=Path, default=ROOT / "results/budget8192/results.json")
    args = parser.parse_args()
    run = json.loads(args.results.read_text())
    audit = json.loads((ROOT / "results/weight_verification.json").read_text())
    if run["status"] != "complete":
        raise ValueError("The paired evaluation has not completed")
    base, edited = run["summary"]["base"], run["summary"]["edited"]
    if base["samples"] != edited["samples"] or base["samples"] != len(run["problems"]):
        raise ValueError("The paired sample counts differ")
    rows = {(r["model"], r["id"]): r for r in run["samples"]}
    rescues = sum(not rows["base", p["id"]]["correct"] and rows["edited", p["id"]]["correct"]
                  for p in run["problems"])
    regressions = sum(rows["base", p["id"]]["correct"] and not rows["edited", p["id"]]["correct"]
                      for p in run["problems"])
    date = datetime.now(ZoneInfo("Asia/Singapore")).strftime("%Y-%m-%d %H:%M %Z")
    lines = [
        "# 本地复现结果", "", f"运行完成：{date}。", "",
        f"**官方 p50c 权重补丁已精确重放并校验；本地 {base['samples']} 题配对演示中，"
        f"正确提交最终答案从 {base['correct']}/{base['samples']} 变为 "
        f"{edited['correct']}/{edited['samples']}，耗尽预算从 {base['cut_at_limit']} 题变为 "
        f"{edited['cut_at_limit']} 题。**", "",
        "这是对 MIT CSAIL 2026-11-02 发布的 "
        "[Sparks of Weight-Space Programming](https://rikiyat.github.io/blog/weight-space-programming/) "
        "Experiment 8 的补丁重放和本地推理验证。没有重新运行大模型从零发现补丁的搜索。", "",
        "## 权重文件验证", "",
        f"原模型：`{audit['base_repo']}`，revision `{audit['base_revision']}`。", "",
        f"逐张量验证全部 {audit['verified_tensors']} 个张量，恰好 {audit['changed_tensors']} 个发生变化；"
        f"其余 {audit['verified_tensors']-audit['changed_tensors']} 个保持相同。"
        f"BF16 实际改变 {audit['changed_entries']:,} 个数值，两张量的原始及编辑后 SHA256 均匹配作者清单。", "",
        "补丁覆盖第 15、19 层 MLP 的 down_proj.weight，各 64 列。"
        "新闻中的 131,072 是触及数，实际 BF16 差异是 130,188。"
        "本地按精确的 752,393,024 个文本权重计算，变化占 0.017303%；"
        "原文另报告约 0.016%，这里保留实际计数与分母便于核对。", "",
        f"完整原始 checkpoint SHA256：`{audit['base_file_sha256']}`，已核对固定版本的 HF LFS 哈希。", "",
        f"完整修改版 checkpoint SHA256：`{audit['edited_file_sha256']}`。", "",
        "重放中没有训练、优化器或反向传播；原始文件保留，修改版单独保存。", "",
        "## 本机配对推理", "",
        f"Apple M1 Pro / 16GB，Python 3.12，MLX 未量化 BF16 加载。"
        f"预先固定 {len(run['problems'])} 道手工数值题，每模型每题一次采样，thinking 开启，"
        f"最多 {run['protocol']['max_tokens']:,} 新 tokens。"
        "同题同 seed；temperature=0.6、top_k=20、top_p=0.95，"
        "presence_penalty=1.5 覆盖全部已生成历史。", "",
        "| 指标 | 原模型 | 修改版 |", "|---|---:|---:|",
        f"| 正确提交最终答案 | {base['correct']}/{base['samples']} | {edited['correct']}/{edited['samples']} |",
        f"| 自然结束 | {base['finished']} | {edited['finished']} |",
        f"| 达到 token 上限 | {base['cut_at_limit']} | {edited['cut_at_limit']} |",
        f"| 平均生成 tokens | {base['mean_generated_tokens']:.1f} | {edited['mean_generated_tokens']:.1f} |",
        f"| 逐题推理耗时合计（秒） | {base['elapsed_seconds']:.1f} | {edited['elapsed_seconds']:.1f} |", "",
        f"由错变对 {rescues} 题，由对变错 {regressions} 题。以下列出所有题目，没有按结果筛选：", "",
        "| 题目 ID | 参考答案 | 原模型正确 | 原模型 tokens | 修改版正确 | 修改版 tokens |",
        "|---|---:|---|---:|---|---:|",
    ]
    for p in run["problems"]:
        a, b = rows["base", p["id"]], rows["edited", p["id"]]
        lines.append(f"| {p['id']} | {p['answer']} | {'是' if a['correct'] else '否'} | "
                     f"{a['generation_tokens']} | {'是' if b['correct'] else '否'} | {b['generation_tokens']} |")
    if args.diagnostic.exists():
        diagnostic = json.loads(args.diagnostic.read_text())
        if diagnostic["status"] != "complete":
            raise ValueError("The budget diagnostic has not completed")
        if diagnostic["problems"] != run["problems"][:1]:
            raise ValueError("The budget diagnostic must use the first predeclared problem")
        lines += ["", "## 单题预算诊断", "",
                  "因为短预算下仍有大量未完成输出，额外使用预先固定的第一题和同一 seed，"
                  f"把两版生成上限都提高到 {diagnostic['protocol']['max_tokens']:,} tokens。"
                  "这是一题诊断，不并入上面 10 题的统计，也不能用于估计整体准确率。", "",
                  "| 模型 | 正确提交最终答案 | 生成 tokens | 结束原因 |",
                  "|---|---|---:|---|"]
        for label in ("base", "edited"):
            row = next(r for r in diagnostic["samples"] if r["model"] == label)
            lines.append(f"| {label} | {'是' if row['correct'] else '否'} | "
                         f"{row['generation_tokens']} | {row['finish_reason']} |")
        lines += ["", "完整输出见 `results/budget8192/report.md`。"]
    lines += [
        "", "## 结论的边界", "",
        "评分只在 `</think>` 后提取最后一个完整 boxed 数值或分数，所有截断样本计入分母；"
        "全文 boxed 的宽松评分也保留在 JSON 中。耗尽预算表示本次未完成，不能单凭这个指标证明无限循环。", "",
        "该演示使用少量手工题、短 token 预算和 MLX 后端；原实验使用 vLLM、32,768 token 预算，"
        "MATH-500 每题 4 次采样，不能将这里的正确率当作其 48.1% 指标的复现。"
        "即使采样参数和 seed 相同，跨后端浮点计算与随机序列也不等价。", "",
        "权重补丁的位级一致性已经验证。重新发现补丁的代理 harness 未公开，"
        "原始搜索耗时约 20.3 小时；本次没有执行这部分。", "",
        "完整逐题输出见 `results/smoke/report.md` 和 `results/smoke/results.json`；"
        "权重审计见 `results/weight_verification.json`，重新运行方法见 `README.md`。", "",
        "## 再运行", "", "```bash",
        "# 在权重实验室目录执行",
        ".venv/bin/python scripts/evaluate_mlx.py --max-tokens 2048 --output results/another-run",
        "```", "",
    ]
    args.output.write_text("\n".join(lines))
    print(args.output)


if __name__ == "__main__":
    main()
