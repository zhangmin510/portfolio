#!/usr/bin/env python3
"""Download the pinned original checkpoint and replay the released p50c BF16 edit."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
REVISION = "2fc06364715b967f1860aea9cf38778875588b17"
REPO = "Qwen/Qwen3.5-0.8B"
BASE_FILE_SHA256 = "04b1c301231dd422b8860db31311ab2721511346a32cb1e079c4c4e5f1fe4696"
UPSTREAM_COMMIT = "4d09ba6d6a7e891dd8063974dfe81b3d78e3494f"
UPSTREAM = ROOT / "upstream/lm_understand-logs"
EXP = UPSTREAM / "exp8_math"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def tensor_hash(path, offset, size):
    h = hashlib.sha256()
    with path.open("rb") as f:
        f.seek(offset)
        while size:
            block = f.read(min(size, 8 * 1024 * 1024))
            if not block:
                raise EOFError(path)
            h.update(block)
            size -= len(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=ROOT / "models/base")
    parser.add_argument("--edited", type=Path, default=ROOT / "models/edited")
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    base, edited = args.base.resolve(), args.edited.resolve()
    if base == edited:
        raise ValueError("Base and edited directories must differ")
    commit = subprocess.check_output(
        ["git", "-C", str(UPSTREAM), "rev-parse", "HEAD"], text=True
    ).strip()
    if commit != UPSTREAM_COMMIT:
        raise ValueError(f"Unexpected upstream revision: {commit}")
    for tracked in ("exp8_math/code", "exp8_math/runs/p50c/edit"):
        if subprocess.check_output(["git", "-C", str(UPSTREAM), "status", "--porcelain", "--untracked-files=no", "--", tracked]):
            raise ValueError(f"Modified upstream source: {tracked}")

    os.environ.setdefault("HF_HOME", str(ROOT / ".cache/huggingface"))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    from huggingface_hub import snapshot_download
    import numpy as np

    if not args.offline:
        snapshot_download(
            REPO, revision=REVISION, local_dir=str(base), max_workers=3,
            allow_patterns=["*.safetensors", "model.safetensors.index.json", "config.json", "generation_config.json",
                            "tokenizer.json", "tokenizer_config.json", "chat_template.jinja",
                            "special_tokens_map.json", "added_tokens.json", "vocab.json", "merges.txt",
                            "preprocessor_config.json", "video_preprocessor_config.json",
                            "LICENSE", "README.md", ".gitattributes"],
        )
    required = ["config.json", "tokenizer.json", "tokenizer_config.json"]
    for name in required:
        if not (base / name).is_file():
            raise FileNotFoundError(base / name)

    sys.path.insert(0, str(EXP / "code"))
    import apply_edit as official
    import st_numpy as st
    manifest_path = EXP / "runs/p50c/edit/manifest.json"
    archive_path = manifest_path.with_name("edit.npz")
    manifest = json.loads(manifest_path.read_text())
    checkpoints = sorted(base.glob("*.safetensors"))
    if len(checkpoints) != 1:
        raise ValueError(f"Expected the pinned single checkpoint, got {checkpoints}")
    original = checkpoints[0]
    base_file_hash = tensor_hash(original, 0, original.stat().st_size)
    if base_file_hash != BASE_FILE_SHA256:
        raise ValueError("Checkpoint file differs from the pinned Hugging Face LFS SHA256")
    edited.mkdir(parents=True, exist_ok=True)
    destination = edited / original.name
    # Copy the original bytes, then overwrite only the two hash-checked tensor regions.
    # This preserves every other tensor and the full HF header, without loading 2GB at once.
    temp = destination.with_suffix(".safetensors.partial")
    print("Copying checkpoint and applying the official sparse edit…", flush=True)
    shutil.copyfile(original, temp)
    header, data_start = st.read_header(original)
    changes = []
    names = [t["name"] for t in manifest["tensors"]]
    tensors = st.load(original, names)
    with np.load(archive_path) as archive, temp.open("r+b") as out:
        for i, spec in enumerate(manifest["tensors"]):
            name = spec["name"]
            dtype, before = tensors[name]
            if dtype != "BF16" or list(before.shape) != spec["shape"]:
                raise ValueError(f"Wrong dtype/shape: {name}")
            if sha256(before.tobytes()) != spec["base_sha256"]:
                raise ValueError(f"Original tensor hash mismatch: {name}")
            after = official.rebuild(before, spec, archive, i)
            if sha256(after.tobytes()) != spec["edited_sha256"]:
                raise ValueError(f"Edited tensor hash mismatch: {name}")
            changed = before != after
            count = int(changed.sum())
            columns = np.flatnonzero(changed.any(axis=0)).tolist()
            if count != spec["changed_entries"] or len(columns) != spec["changed_columns"]:
                raise ValueError(f"Wrong difference count: {name}")
            out.seek(data_start + header[name]["data_offsets"][0])
            out.write(after.tobytes())
            changes.append({"name": name, "shape": list(before.shape),
                            "changed_entries": count, "changed_columns": columns,
                            "base_sha256": spec["base_sha256"],
                            "edited_sha256": spec["edited_sha256"]})
            print(f"  {name}: {count:,} BF16 values; both hashes match", flush=True)
    # Verify ALL tensor bytes on disk, including untouched language and vision weights.
    changed_by_name = {s["name"]: s for s in changes}
    total_entries = 0
    checked = 0
    print("Verifying every tensor in original and edited files…", flush=True)
    for name, spec in header.items():
        if name == "__metadata__":
            continue
        start, end = spec["data_offsets"]
        before_hash = tensor_hash(original, data_start + start, end - start)
        after_hash = tensor_hash(temp, data_start + start, end - start)
        if name in changed_by_name:
            if after_hash != changed_by_name[name]["edited_sha256"]:
                raise ValueError(f"On-disk edited hash mismatch: {name}")
        elif before_hash != after_hash:
            raise ValueError(f"Unexpected change to tensor: {name}")
        if name.startswith("model.language_model.") or name == "lm_head.weight":
            total_entries += int(np.prod(spec["shape"]))
        checked += 1
    temp.replace(destination)
    edited_file_hash = tensor_hash(destination, 0, destination.stat().st_size)
    # All prompt/tokenizer/config files remain byte-identical.
    config_hashes = {}
    for p in base.iterdir():
        if p.is_file() and (p.suffix in (".json", ".jinja", ".txt") or p.name in ("LICENSE", "README.md", ".gitattributes")):
            shutil.copyfile(p, edited / p.name)
            config_hashes[p.name] = sha256(p.read_bytes())
            if sha256((edited / p.name).read_bytes()) != config_hashes[p.name]:
                raise ValueError(f"Config copy mismatch: {p.name}")
    changed_total = sum(s["changed_entries"] for s in changes)
    report = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "method": "replay of official p50c sparse BF16 diff; no training or gradient updates",
        "base_repo": REPO, "base_revision": REVISION, "upstream_commit": commit,
        "base_dir": str(base), "edited_dir": str(edited),
        "base_file_sha256": base_file_hash, "edited_file_sha256": edited_file_hash,
        "patch_sha256": sha256(archive_path.read_bytes()),
        "manifest_sha256": sha256(manifest_path.read_bytes()),
        "verified_tensors": checked, "changed_tensors": len(changes),
        "all_other_tensors_identical": True, "config_file_sha256": config_hashes,
        "language_model_parameters": total_entries, "changed_entries": changed_total,
        "changed_percent": 100 * changed_total / total_entries,
        "changes": changes,
    }
    results = ROOT / "results"
    results.mkdir(exist_ok=True)
    (results / "weight_verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Verified {checked} tensors; changed {changed_total:,} values "
          f"({report['changed_percent']:.6f}% of text weights).", flush=True)
    print(f"Ready: {destination}")


if __name__ == "__main__":
    main()
