#!/usr/bin/env python3
"""Export small, auditable visualization data from the local BF16 checkpoints."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import struct

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DTYPE_BYTES = {"BF16": 2, "F16": 2, "F32": 4, "F64": 8, "I64": 8,
               "I32": 4, "I16": 2, "I8": 1, "U8": 1, "BOOL": 1}


def header(path):
    with path.open("rb") as f:
        size = struct.unpack("<Q", f.read(8))[0]
        return json.loads(f.read(size)), size + 8


def read_bf16(path, spec, offset):
    assert spec["dtype"] == "BF16"
    start, end = spec["data_offsets"]
    bits = np.memmap(path, mode="r", dtype="<u2", offset=offset + start,
                     shape=tuple(spec["shape"]))
    assert bits.nbytes == end - start
    return bits


def f32(bits):
    return (np.asarray(bits, dtype=np.uint32) << 16).view(np.float32)


def stats(a):
    v = a.astype(np.float64)
    return {"mean": float(v.mean()), "std": float(v.std()), "min": float(v.min()),
            "max": float(v.max()), "l2": float(np.linalg.norm(v.ravel()))}


def category(name):
    if name.startswith("model.visual."):
        return "vision"
    if name.startswith("model.language_model.") or name == "lm_head.weight":
        if "embed_tokens" in name or name == "lm_head.weight":
            return "embeddings"
        if ".mlp." in name:
            return "text_mlp"
        if ".self_attn." in name or ".linear_attn." in name:
            return "text_attention"
        return "text_norm"
    return "other"


def evaluation(path):
    if not path.exists():
        return {"status": "not_run"}
    d = json.loads(path.read_text())
    samples = []
    for s in d["samples"]:
        samples.append({"model": s["model"], "id": s["id"], "problem": s["problem"],
                        "answer": s["expected"], "predicted": s["predicted"],
                        "correct": s["correct"], "tokens": s["generation_tokens"],
                        "finish": s["finish_reason"], "thought_closed": s["thought_closed"],
                        "seconds": s["elapsed_seconds"],
                        "correct_if_boxed_anywhere": s["correct_if_boxed_anywhere"]})
    return {"status": d["status"], "protocol": d["protocol"], "summary": d["summary"],
            "samples": samples, "environment": d["environment"],
            "results_path": str(path), "updated_at": d["updated_at"]}


def compact_floats(value):
    if isinstance(value, float):
        assert math.isfinite(value)
        return float(format(value, ".7g"))
    if isinstance(value, list):
        return [compact_floats(x) for x in value]
    if isinstance(value, dict):
        return {k: compact_floats(v) for k, v in value.items()}
    return value


def file_info(path, known_sha256=None):
    """File inventory; checkpoints can reuse the independently verified hash."""
    result = {"path": str(path.resolve()), "name": path.name, "bytes": path.stat().st_size}
    if known_sha256 is not None:
        result["sha256"] = known_sha256
        result["sha256_source"] = "results/weight_verification.json; whole-file verified"
    else:
        with path.open("rb") as f:
            result["sha256"] = hashlib.file_digest(f, "sha256").hexdigest()
        result["sha256_source"] = "computed during inventory export"
    return result


def original_text_file(path):
    item = file_info(path)
    item["raw_text"] = path.read_text()
    if path.suffix == ".json":
        item["content"] = json.loads(item["raw_text"])
    return item


def export_inventory(base, edited, bh, bo, audit, destination):
    """Keep complete small metadata, while pointing to the unchanged full vocab files."""
    with base.open("rb") as f:
        size = struct.unpack("<Q", f.read(8))[0]
        raw_header = f.read(size)
    config_files = {}
    for label, folder in (("base", base.parent), ("edited", edited.parent)):
        config_files[label] = {p.name: original_text_file(p)
                               for p in folder.glob("*config.json")}
    experiment = ROOT / "upstream/lm_understand-logs/exp8_math/base_model/Qwen3.5-0.8B-text"
    config_files["official_experiment_text_export"] = {
        p.name: original_text_file(p) for p in experiment.iterdir()
        if p.is_file() and (p.suffix == ".json" or p.suffix == ".jinja")
    }
    tokenizer_path = base.parent / "tokenizer.json"
    tokenizer = json.loads(tokenizer_path.read_text())
    tokenizer_model = tokenizer.get("model", {})
    vocab = tokenizer_model.get("vocab", {})
    added = tokenizer.get("added_tokens", [])
    vocabulary_ids = set(vocab.values())
    vocabulary_ids.update(t["id"] for t in added)
    tokenizer_config = json.loads((base.parent / "tokenizer_config.json").read_text())
    config_decoder = tokenizer_config.get("added_tokens_decoder", {})
    config_ids = {int(token_id) for token_id in config_decoder}
    union_ids = vocabulary_ids | config_ids
    config_only_tokens = [{"id": int(token_id), **token} for token_id, token in config_decoder.items()
                          if int(token_id) not in vocabulary_ids]
    specials = [t for t in added if t.get("special")]
    template_path = base.parent / "chat_template.jinja"
    files = {}
    for label, folder, weight in (("base", base.parent, base), ("edited", edited.parent, edited)):
        files[label] = [file_info(p, audit[label + "_file_sha256"] if p == weight else None)
                        for p in sorted(folder.iterdir()) if p.is_file()]
    value = {
        "schema_version": 1, "generated_utc": datetime.now(timezone.utc).isoformat(),
        "model_name": audit["base_repo"], "model_revision": audit["base_revision"],
        "checkpoint": {
            "base": file_info(base, audit["base_file_sha256"]),
            "edited": file_info(edited, audit["edited_file_sha256"]),
            "header": bh, "header_raw_json": raw_header.decode(),
            "header_sha256": hashlib.sha256(raw_header).hexdigest(),
            "header_bytes": size, "data_start": bo, "edited_header_identical": True,
        },
        "config_files": config_files, "files": files,
        "tokenizer": {
            "file": file_info(tokenizer_path),
            "base_vocab_size": len(vocab), "added_tokens_count": len(added),
            "total_defined_token_ids": len(vocabulary_ids),
            "total_defined_token_ids_source": "tokenizer.json only; not an asserted runtime vocabulary size",
            "tokenizer_json_defined_ids": len(vocabulary_ids),
            "union_config_defined_token_ids": len(union_ids),
            "union_config_min_defined_token_id": min(union_ids),
            "union_config_max_defined_token_id": max(union_ids),
            "config_only_tokens": config_only_tokens,
            "vocabulary_sources": "tokenizer.json defines the BPE vocabulary and its added_tokens; tokenizer_config.json declares additional added-token IDs. The union is recorded separately and is not inferred by loading a runtime tokenizer.",
            "min_defined_token_id": min(vocabulary_ids), "max_defined_token_id": max(vocabulary_ids),
            "model_embedding_rows": json.loads((base.parent / "config.json").read_text())
                                    .get("text_config", {}).get("vocab_size"),
            "merges_count": len(tokenizer_model.get("merges", [])),
            "added_tokens": added, "special_tokens": specials,
            "config_added_tokens_decoder": config_decoder,
            "config_special_token_fields": {k: v for k, v in tokenizer_config.items()
                                             if "token" in k and k != "added_tokens_decoder"},
            "components": {k: v for k, v in tokenizer.items() if k not in ("model", "added_tokens")},
            "model_options": {k: v for k, v in tokenizer_model.items() if k not in ("vocab", "merges")},
            "vocabulary_files": [file_info(base.parent / name) for name in
                                 ("tokenizer.json", "vocab.json", "merges.txt")
                                 if (base.parent / name).exists()],
            "vocabulary_content": "Full vocabulary and merges remain in the original local files; use the local explorer API for pagination and exact lookup.",
        },
        "chat_template": {**file_info(template_path), "text": template_path.read_text(),
                          "characters": len(template_path.read_text()),
                          "lines": len(template_path.read_text().splitlines()),
                          "config_template_identical": tokenizer_config.get("chat_template") == template_path.read_text()},
        "audit": audit,
        "coverage": {
            "complete": ["checkpoint_header", "configuration_files", "tokenizer_configuration",
                         "tokenizer_components", "special_and_added_tokens", "chat_template", "local_file_inventory"],
            "referenced_without_duplication": ["full_weight_values", "full_vocabulary", "BPE_merges"],
            "notes": "Parsed objects and original raw text are both retained for small metadata. Weight values/vocabulary are accessed from the unchanged source files rather than duplicated into this inventory.",
        },
    }
    destination.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    return value


def streaming_statistics(path, name, spec, data_start, chunk_values=1_048_576):
    """Exact all-value scan; float64 moments are combined with batch Welford."""
    dtype = spec["dtype"]
    np_dtype = {"BF16": "<u2", "F16": "<f2", "F32": "<f4", "F64": "<f8",
                "I64": "<i8", "I32": "<i4", "I16": "<i2", "I8": "i1",
                "U8": "u1", "BOOL": "?"}[dtype]
    count = math.prod(spec["shape"])
    bytes_left = spec["data_offsets"][1] - spec["data_offsets"][0]
    total_bytes = bytes_left
    seen = finite_count = zero_count = nan_count = posinf_count = neginf_count = 0
    negative_count = positive_count = 0
    mean = m2 = squared_sum = 0.0
    minimum, maximum = math.inf, -math.inf
    checksum = hashlib.sha256()
    with path.open("rb") as f:
        f.seek(data_start + spec["data_offsets"][0])
        while bytes_left:
            size = min(bytes_left, chunk_values * DTYPE_BYTES[dtype])
            raw = f.read(size)
            if len(raw) != size:
                raise EOFError(f"Truncated tensor {name}")
            checksum.update(raw)
            values = np.frombuffer(raw, dtype=np_dtype)
            if dtype == "BF16":
                values = f32(values)
            seen += values.size
            zeros = int(np.count_nonzero(values == 0))
            nan_count += int(np.count_nonzero(np.isnan(values)))
            posinf_count += int(np.count_nonzero(np.isposinf(values)))
            neginf_count += int(np.count_nonzero(np.isneginf(values)))
            zero_count += zeros
            negative_count += int(np.count_nonzero(values < 0))
            positive_count += int(np.count_nonzero(values > 0))
            finite_mask = np.isfinite(values)
            current_count = int(np.count_nonzero(finite_mask))
            if current_count:
                finite = np.asarray(values if current_count == values.size else values[finite_mask],
                                    dtype=np.float64)
                current_mean = float(finite.mean())
                current_m2 = float(finite.var()) * current_count
                delta = current_mean - mean
                new_count = finite_count + current_count
                m2 += current_m2 + delta * delta * finite_count * current_count / new_count
                mean += delta * current_count / new_count
                finite_count = new_count
                squared_sum += float(np.dot(finite, finite))
                minimum = min(minimum, float(finite.min()))
                maximum = max(maximum, float(finite.max()))
            bytes_left -= size
    assert seen == count
    assert finite_count + nan_count + posinf_count + neginf_count == count
    statistics = {
        "min": minimum if finite_count else None, "max": maximum if finite_count else None,
        "mean": mean if finite_count else None,
        "std": math.sqrt(max(0.0, m2 / finite_count)) if finite_count else None,
        "l2": math.sqrt(squared_sum) if finite_count else None,
        "zero_count": zero_count, "zero_fraction": zero_count / count if count else 0,
        "finite_count": finite_count, "nonfinite_count": count - finite_count,
        "nan_count": nan_count, "posinf_count": posinf_count, "neginf_count": neginf_count,
        "negative_count": negative_count, "positive_count": positive_count,
    }
    return {"name": name, "shape": spec["shape"], "dtype": dtype, "params": count,
            "bytes": total_bytes, "sha256": checksum.hexdigest(), "statistics": statistics}


def aggregate_statistics(items):
    """Combine complete tensor moments without rereading checkpoint values."""
    if not items:
        return None
    entries = [item["statistics"] for item in items]
    n = sum(s["finite_count"] for s in entries)
    all_count = sum(item["params"] for item in items)
    finite_entries = [s for s in entries if s["finite_count"]]
    mean = sum(s["mean"] * s["finite_count"] for s in finite_entries) / n if n else None
    m2 = sum((s["std"] ** 2 + (s["mean"] - mean) ** 2) * s["finite_count"]
             for s in finite_entries) if n else 0
    result = {"min": min(s["min"] for s in finite_entries) if n else None,
              "max": max(s["max"] for s in finite_entries) if n else None,
              "mean": mean, "std": math.sqrt(m2 / n) if n else None,
              "l2": math.sqrt(sum(s["l2"] ** 2 for s in finite_entries)) if n else None}
    for key in ("zero_count", "finite_count", "nonfinite_count", "nan_count", "posinf_count",
                "neginf_count", "negative_count", "positive_count"):
        result[key] = sum(s[key] for s in entries)
    result["zero_fraction"] = result["zero_count"] / all_count if all_count else 0
    return result


def export_all_statistics(base, edited, bh, bo, eh, eo, audit, destination):
    tensors = []
    names = [name for name in bh if name != "__metadata__"]
    for i, name in enumerate(names):
        tensors.append(streaming_statistics(base, name, bh[name], bo))
        if (i + 1) % 32 == 0 or i + 1 == len(names):
            print(f"Full statistics: {i+1}/{len(names)} tensors", flush=True)
    original = {t["name"]: t for t in tensors}
    overrides = []
    for change in audit["changes"]:
        name = change["name"]
        assert original[name]["sha256"] == change["base_sha256"]
        item = streaming_statistics(edited, name, eh[name], eo)
        assert item["sha256"] == change["edited_sha256"]
        item["changed_entries"] = change["changed_entries"]
        overrides.append(item)
    assert len(tensors) == audit["verified_tensors"]
    payload = {
        "schema_version": 1, "generated_utc": datetime.now(timezone.utc).isoformat(),
        "base_file": str(base), "base_file_sha256": audit["base_file_sha256"],
        "edited_file": str(edited), "edited_file_sha256": audit["edited_file_sha256"],
        "method": {"coverage": "Every stored element, not a sample", "chunk_values": 1_048_576,
                   "moments": "float64 population moments; batch Welford combination",
                   "nonfinite_policy": "Nonfinite values are counted separately; moments/min/max/L2 use only finite values",
                   "sha256": "Raw on-disk tensor bytes, before decoding",
                   "edited_policy": "Only the two changed tensors are rescanned; all other tensor bytes were verified identical"},
        "summary": {"tensor_count": len(tensors), "parameters": sum(t["params"] for t in tensors),
                    "bytes": sum(t["bytes"] for t in tensors),
                    "zero_count": sum(t["statistics"]["zero_count"] for t in tensors),
                    "nonfinite_count": sum(t["statistics"]["nonfinite_count"] for t in tensors),
                    "statistics": aggregate_statistics(tensors),
                    "edited_override_count": len(overrides),
                    "edited_same_as_base_count": len(tensors) - len(overrides)},
        "tensors": tensors, "edited_overrides": overrides,
    }
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "results/visual-data.json")
    parser.add_argument("--full", action="store_true", help="Scan every tensor and export complete statistics")
    parser.add_argument("--statistics-output", type=Path, default=ROOT / "results/tensor-statistics.json")
    parser.add_argument("--inventory-output", type=Path, default=ROOT / "results/model-inventory.json")
    args = parser.parse_args()
    base = next((ROOT / "models/base").glob("*.safetensors"))
    edited = ROOT / "models/edited" / base.name
    config = json.loads((ROOT / "models/base/config.json").read_text())
    audit = json.loads((ROOT / "results/weight_verification.json").read_text())
    bh, bo = header(base)
    eh, eo = header(edited)
    assert bh == eh, "Checkpoint headers differ"
    args.inventory_output.parent.mkdir(parents=True, exist_ok=True)
    export_inventory(base, edited, bh, bo, audit, args.inventory_output)
    if args.full:
        args.statistics_output.parent.mkdir(parents=True, exist_ok=True)
        export_all_statistics(base, edited, bh, bo, eh, eo, audit, args.statistics_output)
    edited_names = {t["name"] for t in audit["changes"]}
    text = config.get("text_config", config)
    layer_stats = [{"layer": i, "attention_type": text["layer_types"][i],
                    "params": 0, "mlp_params": 0, "attention_params": 0,
                    "changed_entries": 0, "changed_columns": 0}
                   for i in range(text["num_hidden_layers"])]
    tensors = []
    groups = {g: {"name": g, "params": 0, "bytes": 0, "tensors": 0}
              for g in ("embeddings", "text_mlp", "text_attention", "text_norm", "vision", "other")}
    dtype_counts = defaultdict(lambda: {"params": 0, "bytes": 0, "tensors": 0})
    for name, spec in bh.items():
        if name == "__metadata__":
            continue
        count = math.prod(spec["shape"])
        size = spec["data_offsets"][1] - spec["data_offsets"][0]
        assert size == count * DTYPE_BYTES[spec["dtype"]]
        cat = category(name)
        match = re.search(r"^model\.language_model\.layers\.(\d+)\.", name)
        layer = int(match[1]) if match else None
        group = "text" if cat.startswith("text_") or cat == "embeddings" else "vision" if cat == "vision" else "other"
        tensors.append({"name": name, "shape": spec["shape"], "dtype": spec["dtype"],
                        "params": count, "bytes": size, "group": group,
                        "category": cat, "layer": layer, "edited": name in edited_names})
        for agg in (groups[cat], dtype_counts[spec["dtype"]]):
            agg["params"] += count
            agg["bytes"] += size
            agg["tensors"] += 1
        if layer is not None:
            layer_stats[layer]["params"] += count
            if cat == "text_mlp":
                layer_stats[layer]["mlp_params"] += count
            if cat == "text_attention":
                layer_stats[layer]["attention_params"] += count
    total = sum(t["params"] for t in tensors)
    assert sum(g["params"] for g in groups.values()) == total
    assert sum(g["params"] for g in dtype_counts.values()) == total
    text_count = sum(t["params"] for t in tensors if t["group"] == "text")
    assert text_count == audit["language_model_parameters"]
    tensor_by_name = {t["name"]: t for t in tensors}
    full_statistics_summary = None
    if args.statistics_output.exists():
        full_statistics = json.loads(args.statistics_output.read_text())
        if full_statistics.get("base_file_sha256") != audit["base_file_sha256"]:
            raise ValueError("Stored full statistics belong to a different checkpoint")
        full_by_name = {t["name"]: t for t in full_statistics["tensors"]}
        assert set(full_by_name) == set(tensor_by_name)
        for layer in layer_stats:
            selected = [full_by_name[t["name"]] for t in tensors if t["layer"] == layer["layer"]]
            layer["weight_statistics"] = aggregate_statistics(selected)
        for group in groups.values():
            selected = [full_by_name[t["name"]] for t in tensors if t["category"] == group["name"]]
            group["weight_statistics"] = aggregate_statistics(selected)
        full_statistics_summary = full_statistics["summary"]
        if "statistics" not in full_statistics_summary:
            full_statistics_summary["statistics"] = aggregate_statistics(full_statistics["tensors"])
            args.statistics_output.write_text(json.dumps(full_statistics, ensure_ascii=False, indent=2,
                                                         allow_nan=False) + "\n")
    edits = []
    for change in audit["changes"]:
        name = change["name"]
        layer = tensor_by_name[name]["layer"]
        before_bits = read_bf16(base, bh[name], bo)
        after_bits = read_bf16(edited, eh[name], eo)
        assert hashlib.sha256(before_bits.tobytes()).hexdigest() == change["base_sha256"]
        assert hashlib.sha256(after_bits.tobytes()).hexdigest() == change["edited_sha256"]
        different = np.asarray(before_bits) != np.asarray(after_bits)
        count = int(different.sum())
        columns = np.flatnonzero(different.any(axis=0)).tolist()
        assert count == change["changed_entries"]
        assert columns == change["changed_columns"] and len(columns) == 64
        before, after = f32(before_bits), f32(after_bits)
        delta = after - before
        bound = float(max(abs(before).max(), abs(after).max(), abs(delta).max())) * 1.000001
        edges = np.linspace(-bound, bound, 65)
        hist = {"edges": edges.tolist()}
        for label, arr in (("before", before), ("after", after), ("delta", delta)):
            hist[label] = np.histogram(arr, bins=edges)[0].tolist()
            assert sum(hist[label]) == arr.size
        sample_rows = np.linspace(0, before.shape[0] - 1, 64, dtype=int)
        selected = np.ix_(sample_rows, columns)
        heatmap = {"rows": 64, "cols": 64, "row_indices": sample_rows.tolist(),
                   "column_indices": columns,
                   "before": before[selected].tolist(), "after": after[selected].tolist(),
                   "delta": delta[selected].tolist(),
                   "sampling": "64 uniformly spaced actual rows × all 64 edited columns; no aggregation"}
        assert len(heatmap["before"]) == 64 and len(heatmap["before"][0]) == 64
        edits.append({"layer": layer, "name": name, "shape": list(before.shape),
                      "changed_entries": count, "selected_columns": columns,
                      "stats": {"before": stats(before), "after": stats(after), "delta": stats(delta)},
                      "histogram": hist, "heatmap": heatmap})
        layer_stats[layer]["changed_entries"] = count
        layer_stats[layer]["changed_columns"] = len(columns)
    assert sum(e["changed_entries"] for e in edits) == audit["changed_entries"]
    assert len(tensors) == audit["verified_tensors"] == 488
    slim_audit = {k: audit[k] for k in ("base_revision", "upstream_commit", "verified_tensors", "changed_tensors",
                  "all_other_tensors_identical", "changed_entries", "changed_percent", "base_file_sha256",
                  "edited_file_sha256", "patch_sha256")}
    result = {"schema_version": 1, "generated_utc": datetime.now(timezone.utc).isoformat(),
              "model": {"name": audit["base_repo"], "revision": audit["base_revision"],
                        "file_bytes": base.stat().st_size, "tensor_bytes": sum(t["bytes"] for t in tensors),
                        "total_parameters": total, "text_parameters": text_count,
                        "vision_parameters": groups["vision"]["params"],
                        "other_parameters": groups["other"]["params"],
                        "dtype_counts": dict(dtype_counts),
                        "config": {"architecture": config["architectures"], "model_type": config["model_type"],
                                   "text": text, "vision": config.get("vision_config", {})}},
              "tensors": tensors, "layer_stats": layer_stats, "edits": edits,
              "groups": list(groups.values()), "evaluation": evaluation(ROOT / "results/smoke/results.json"),
              "diagnostic": evaluation(ROOT / "results/budget8192/results.json"),
              "audit": slim_audit,
              "full_information": {"inventory_path": str(args.inventory_output),
                                   "statistics_path": str(args.statistics_output),
                                   "statistics_available": args.statistics_output.exists(),
                                   "statistics_summary": full_statistics_summary,
                                   "exact_values": "Available on demand from local checkpoint tensor slices"},
              "sources": {"blog": "https://rikiyat.github.io/blog/weight-space-programming/",
                          "upstream": "https://github.com/RikiyaT/lm_understand-logs",
                          "model": "https://huggingface.co/Qwen/Qwen3.5-0.8B/tree/" + audit["base_revision"],
                          "local_checkpoint": str(base)},
              "notes": {"heatmap": "64实际行 × 64修改列的真实BF16值；非完整矩阵、非均值",
                        "histogram": "完整1024×3584目标矩阵的精确频数；delta包括未修改元素的零值",
                        "evaluation": "手工题、小样本、短预算MLX验证，不是原文MATH-500评测",
                        "parameters": "按safetensors实际存储元素计数，含视觉及其他张量；共享嵌入不重复计算"}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(compact_floats(result), ensure_ascii=False, separators=(",", ":"))
    assert len(payload.encode()) < 650_000, f"Visualization payload too large: {len(payload.encode())}"
    args.output.write_text(payload + "\n")
    print(json.dumps({"path": str(args.output), "bytes": args.output.stat().st_size,
                      "tensors": len(tensors), "total_parameters": total,
                      "text_parameters": text_count, "vision_parameters": groups["vision"]["params"],
                      "other_parameters": groups["other"]["params"],
                      "diagnostic_status": result["diagnostic"]["status"]}, indent=2))


if __name__ == "__main__":
    main()
