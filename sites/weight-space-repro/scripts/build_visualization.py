#!/usr/bin/env python3
"""Embed exported real checkpoint data in the inline visualization template."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def preview_only(value):
    if isinstance(value, dict):
        return {k: preview_only(v) for k, v in value.items()
                if k not in {"vector", "input_vector", "output_vector"}}
    if isinstance(value, list):
        return [preview_only(v) for v in value]
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "results/qwen-weight-atlas.html")
    args = parser.parse_args()
    template = (ROOT / "visualization.template.html").read_text()
    assert template.count("__QWEN_DATA_JSON__") == 1
    data = json.loads((ROOT / "results/visual-data.json").read_text())
    assert len(data["tensors"]) == 488
    assert data["evaluation"]["status"] == "complete"
    trace_file = ROOT / "results/inference-trace.json"
    if trace_file.exists():
        data["inference"] = preview_only(json.loads(trace_file.read_text()))
        data["inference"]["inline_scope"] = "Eight-dimension previews; full vectors and vocabulary probabilities retained in the local trace and NPZ archive"
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    fragment = template.replace("__QWEN_DATA_JSON__", payload)
    assert "<!doctype" not in fragment.lower() and "<body" not in fragment.lower()
    assert len(fragment.encode()) < 1_000_000
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(fragment)
    print(f"{args.output} ({len(fragment.encode()):,} bytes)")


if __name__ == "__main__":
    main()
