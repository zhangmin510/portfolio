#!/usr/bin/env python3
"""Paired, unquantized local demonstration of the published Qwen weight edit.

This uses hand-written problems, one sample each, and a reduced token budget.
It is NOT a replication of the authors' full MATH-500 evaluation.
"""
from __future__ import annotations

import argparse
import gc
import hashlib
import importlib.metadata
import json
import platform
import re
import sys
import time
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SUFFIX = "Please reason step by step, and put your final answer within \\boxed{}."


def last_boxed(text: str) -> str | None:
    """Extract the last balanced \\boxed{...}, including nested fraction braces."""
    found = None
    for match in re.finditer(r"\\boxed\s*\{", text):
        start = match.end()
        depth = 1
        for end in range(start, len(text)):
            if text[end] == "{":
                depth += 1
            elif text[end] == "}":
                depth -= 1
                if depth == 0:
                    found = text[start:end].strip()
                    break
    return found


def numeric_answer(value: str) -> Fraction | None:
    """Small transparent numeric grader; deliberately not a symbolic math grader."""
    value = value.strip().replace("$", "").replace("\\,", "").replace(" ", "")
    value = value.replace("\\left", "").replace("\\right", "")
    value = re.sub(r"\\(?:dfrac|tfrac)", r"\\frac", value)
    match = re.fullmatch(r"\\frac\{([-+]?\d+)\}\{([-+]?\d+)\}", value)
    if match:
        value = f"{match[1]}/{match[2]}"
    if not re.fullmatch(r"[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:/[-+]?\d+)?", value):
        return None
    try:
        return Fraction(value)
    except (ValueError, ZeroDivisionError):
        return None


def grade(text: str, expected: str) -> tuple[str | None, bool]:
    predicted = last_boxed(text)
    if predicted is None:
        return None, False
    left, right = numeric_answer(predicted), numeric_answer(expected)
    return predicted, left is not None and right is not None and left == right


def read_data(path: Path, limit: int | None) -> list[dict]:
    if path.suffix.lower() == ".jsonl":
        problems = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    else:
        problems = json.loads(path.read_text())
    if not isinstance(problems, list) or not problems:
        raise ValueError("Dataset must be a nonempty JSON list or JSONL file.")
    identifiers = set()
    for index, problem in enumerate(problems):
        if not isinstance(problem, dict) or not isinstance(problem.get("problem"), str):
            raise ValueError(f"Dataset item {index} needs a string 'problem'.")
        problem.setdefault("id", str(index))
        problem["id"] = str(problem["id"])
        problem["answer"] = str(problem["answer"])
        if numeric_answer(problem["answer"]) is None:
            raise ValueError(f"Only numeric reference answers are supported: {problem['id']}")
        if problem["id"] in identifiers:
            raise ValueError(f"Duplicate problem id: {problem['id']}")
        identifiers.add(problem["id"])
    return problems[:limit] if limit is not None else problems


def package_version(name: str) -> str:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return "not-installed"


def checkpoint_identity(directory: Path) -> dict:
    """Resume guard: config content and weight file sizes/mtimes; not a weight hash."""
    weights = sorted(directory.glob("*.safetensors"))
    if not weights:
        raise FileNotFoundError(f"No safetensors weights in {directory}")
    return {
        "path": str(directory),
        "config_sha256": hashlib.sha256((directory / "config.json").read_bytes()).hexdigest(),
        "weights": [{"name": p.name, "bytes": p.stat().st_size, "mtime_ns": p.stat().st_mtime_ns}
                    for p in weights],
    }


def atomic_json(path: Path, content: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def save_results(directory: Path, document: dict) -> None:
    by_model = {}
    for label in ("base", "edited"):
        rows = [r for r in document["samples"] if r["model"] == label]
        if rows:
            n = len(rows)
            by_model[label] = {
                "samples": n,
                "correct": sum(r["correct"] for r in rows),
                "correct_if_boxed_anywhere": sum(r["correct_if_boxed_anywhere"] for r in rows),
                "accuracy": sum(r["correct"] for r in rows) / n,
                "finished": sum(r["finish_reason"] == "stop" for r in rows),
                "cut_at_limit": sum(r["finish_reason"] == "length" for r in rows),
                "mean_generated_tokens": sum(r["generation_tokens"] for r in rows) / n,
                "elapsed_seconds": sum(r["elapsed_seconds"] for r in rows),
            }
    document["summary"] = by_model
    document["updated_at"] = datetime.now(timezone.utc).isoformat()
    atomic_json(directory / "results.json", document)
    lines = [
        "# 本地配对推理记录", "",
        "这是手工小样本演示，不是论文的 MATH-500 全量复现。"
        "运行后端为 MLX；不量化权重。完整提示词、输出及环境保存在 results.json。", "",
        f"生成预算：每题 {document['protocol']['max_tokens']} tokens；每模型每题 1 次采样；thinking 开启。", "",
        "采样：temperature=0.6，top_k=20，top_p=0.95，generated-only 全历史 presence_penalty=1.5。"
        "与 vLLM 的浮点实现及随机采样序列不保证一致。", "",
        "评分：只在 </think> 之后提取最后一个完整的 \\boxed{}，比较数值和分数。"
        "达到 token 上限的输出也计入总样本；思考未结束则最终答案计错。"
        "JSON 另保留全文 boxed 宽松评分用于核查。", "",
        "| 模型 | 已完成样本 | 正确 | 自然结束 | 达到上限 | 平均生成 tokens |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for label, summary in by_model.items():
        lines.append(f"| {label} | {summary['samples']} | {summary['correct']} | "
                     f"{summary['finished']} | {summary['cut_at_limit']} | "
                     f"{summary['mean_generated_tokens']:.1f} |")
    lines += ["", "## 逐题输出", ""]
    for row in document["samples"]:
        lines += [f"### {row['model']} / {row['id']}", "", row["problem"], "",
                  f"参考答案：{row['expected']}；提取答案：{row['predicted']}；"
                  f"正确：{row['correct']}；停止原因：{row['finish_reason']}；"
                  f"生成 tokens：{row['generation_tokens']}；耗时：{row['elapsed_seconds']:.1f} 秒。", "",
                  "```text", row["text"], "```", ""]
    (directory / "report.md").write_text("\n".join(lines))


def make_sampler(mx):
    # vLLM-style order: temperature, top-k, then top-p on normalized retained mass.
    from mlx_lm.sample_utils import apply_top_k, apply_top_p, categorical_sampling

    def sample(logprobs):
        values = apply_top_k(logprobs / 0.6, 20)
        values = values - mx.logsumexp(values, keepdims=True)
        values = apply_top_p(values, 0.95)
        return categorical_sampling(values, 1.0)

    return sample


def make_generated_presence_processor(mx):
    # MLX's default includes prompt tokens and only looks back 20 tokens.
    # The first call gets the remaining prefill tokens; only subsequent tokens
    # are generated output, matching the scope of vLLM's presence penalty.
    prompt_prefix_length = None

    def process(tokens, logits):
        nonlocal prompt_prefix_length
        if prompt_prefix_length is None:
            prompt_prefix_length = len(tokens)
            return logits
        generated = tokens[prompt_prefix_length:]
        if len(generated):
            counts = mx.zeros_like(logits).at[:, generated].add(1)
            logits = logits - mx.where(counts > 0, 1.5, 0.0)
        return logits

    return process


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=ROOT / "models/base")
    parser.add_argument("--edited", type=Path, default=ROOT / "models/edited")
    parser.add_argument("--data", type=Path, default=ROOT / "data/smoke.json")
    parser.add_argument("--output", type=Path, default=ROOT / "results/smoke")
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.max_tokens < 1 or (args.limit is not None and args.limit < 1):
        parser.error("--max-tokens and --limit must be positive")

    problems = read_data(args.data.resolve(), args.limit)
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    model_paths = {"base": args.base.resolve(), "edited": args.edited.resolve()}
    protocol = {
        "kind": "local_smoke_not_paper_benchmark",
        "thinking": True, "samples_per_problem": 1,
        "temperature": 0.6, "top_k": 20, "top_p": 0.95,
        "presence_penalty": 1.5, "presence_scope": "generated_tokens_full_history",
        "sampler_order": "temperature_top_k_top_p", "max_tokens": args.max_tokens,
        "seed": args.seed, "per_problem_seed": "seed + zero_based_problem_index",
        "user_suffix": SUFFIX, "grader": "post_think_last_balanced_boxed_numeric_fraction_v1",
        "backend": "mlx_lm", "quantized": False,
    }
    experiment = {
        "protocol": protocol, "problems": problems,
        "checkpoints": {label: checkpoint_identity(path) for label, path in model_paths.items()},
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    }
    signature = hashlib.sha256(json.dumps(experiment, sort_keys=True).encode()).hexdigest()
    result_file = args.output / "results.json"
    if result_file.exists():
        if not args.resume:
            parser.error(f"{result_file} exists; use --resume or a different --output")
        document = json.loads(result_file.read_text())
        if document.get("experiment_signature") != signature:
            parser.error("Existing results use a different script, model, dataset or protocol; choose a new --output")
    else:
        document = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "experiment_signature": signature, **experiment,
            "environment": {
                "python": sys.version, "platform": platform.platform(), "machine": platform.machine(),
                "packages": {name: package_version(name) for name in
                             ["mlx", "mlx-metal", "mlx-lm", "transformers", "numpy", "tokenizers"]},
            },
            "samples": [], "status": "running",
        }
    save_results(args.output, document)

    # Import lazily so --help and numeric grading can run without Apple MLX.
    import mlx.core as mx
    from mlx_lm import load, stream_generate

    completed = {(row["model"], row["id"]) for row in document["samples"]}
    for label, model_path in model_paths.items():
        remaining = [(i, p) for i, p in enumerate(problems) if (label, p["id"]) not in completed]
        if not remaining:
            continue
        config = json.loads((model_path / "config.json").read_text())
        if config.get("quantization") or config.get("quantization_config"):
            raise ValueError("This demonstration expects unquantized weights.")
        # Upstream's text-only export keeps original tensor names. MLX's wrapper
        # sanitizes these correctly when routed to the qwen3_5 module.
        override = {"model_type": "qwen3_5"} if config["model_type"] == "qwen3_5_text" else None
        print(f"Loading {label}: {model_path}", flush=True)
        model, tokenizer = load(str(model_path), model_config=override)
        try:
            for index, problem in remaining:
                seed = args.seed + index
                mx.random.seed(seed)
                prompt = tokenizer.apply_chat_template(
                    [{"role": "user", "content": problem["problem"] + "\n" + SUFFIX}],
                    tokenize=False, add_generation_prompt=True, enable_thinking=True,
                )
                started = time.perf_counter()
                chunks = []
                final = None
                print(f"[{label}] {index + 1}/{len(problems)} {problem['id']} (seed={seed})", flush=True)
                try:
                    for response in stream_generate(
                        model, tokenizer, prompt, max_tokens=args.max_tokens,
                        sampler=make_sampler(mx),
                        logits_processors=[make_generated_presence_processor(mx)],
                    ):
                        chunks.append(response.text)
                        final = response
                    if final is None:
                        raise RuntimeError("Generation returned no response")
                    text = "".join(chunks)
                    any_predicted, any_correct = grade(text, problem["answer"])
                    thought_closed = "</think>" in text
                    answer_text = text.rsplit("</think>", 1)[1] if thought_closed else ""
                    predicted, correct = grade(answer_text, problem["answer"])
                    row = {
                        "model": label, "id": problem["id"], "seed": seed,
                        "problem": problem["problem"], "expected": problem["answer"],
                        "prompt": prompt, "text": text, "predicted": predicted, "correct": correct,
                        "thought_closed": thought_closed,
                        "predicted_anywhere": any_predicted,
                        "correct_if_boxed_anywhere": any_correct,
                        "finish_reason": final.finish_reason, "generation_tokens": final.generation_tokens,
                        "prompt_tokens": final.prompt_tokens,
                        "elapsed_seconds": time.perf_counter() - started,
                        "generation_tokens_per_second": final.generation_tps,
                        "peak_memory_gb": final.peak_memory,
                    }
                    document["samples"].append(row)
                    save_results(args.output, document)
                    print(f"  correct={correct}, finish={row['finish_reason']}, "
                          f"tokens={row['generation_tokens']}, seconds={row['elapsed_seconds']:.1f}", flush=True)
                    del response, final
                    mx.clear_cache()
                except BaseException as error:
                    document["status"] = "interrupted_or_failed"
                    document["last_error"] = {"model": label, "id": problem["id"], "type": type(error).__name__}
                    save_results(args.output, document)
                    raise
        finally:
            del model, tokenizer
            gc.collect()
            mx.clear_cache()
    document["status"] = "complete"
    document.pop("last_error", None)
    save_results(args.output, document)
    print(json.dumps(document["summary"], ensure_ascii=False, indent=2), flush=True)
    print(f"Results: {args.output / 'report.md'}", flush=True)


if __name__ == "__main__":
    main()
