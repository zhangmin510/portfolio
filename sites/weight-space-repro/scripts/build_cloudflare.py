#!/usr/bin/env python3
"""Build the public read-only explorer from the verified local checkpoints."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import quote

import numpy as np

from serve_explorer import HEADERS, MODELS, ROOT, floating, json_file, raw_array, vocabulary


CHUNK_VALUES = 524_288
ASSET_LIMIT = 25 * 1024 * 1024
MODEL_FILES = (
    ".gitattributes", "LICENSE", "README.md", "chat_template.jinja", "config.json",
    "generation_config.json", "merges.txt", "model.safetensors.index.json",
    "preprocessor_config.json", "tokenizer.json", "tokenizer_config.json", "video_preprocessor_config.json", "vocab.json",
)
REMOTE_MODEL_FILES = {"tokenizer.json", "vocab.json", "merges.txt"}
COMPRESSED_DATA = ("vocab.json", "inference-trace.json", "histograms.json", "tensors.json")
UPSTREAM = Path("upstream/lm_understand-logs")
TEXT_EXPORT = UPSTREAM / "exp8_math/base_model/Qwen3.5-0.8B-text"
PATCH_EXPORT = UPSTREAM / "exp8_math/runs/p50c/edit"
PUBLIC_FILES = (
    Path("README.md"), Path("REPORT.md"), Path("requirements.lock"), Path("data/smoke.json"),
    Path("results/visual-data.json"), Path("results/model-inventory.json"),
    Path("results/tensor-statistics.json"), Path("results/weight_verification.json"),
    Path("results/inference-trace.json"), Path("results/inference-arrays.npz"),
    Path("results/inference-validation.json"),
    Path("results/smoke/results.json"), Path("results/smoke/report.md"),
    Path("results/budget8192/results.json"), Path("results/budget8192/report.md"),
    UPSTREAM / "LICENSE", UPSTREAM / "README.md", UPSTREAM / "exp8_math/README.md",
    PATCH_EXPORT / "manifest.json", PATCH_EXPORT / "edit.npz",
    *(TEXT_EXPORT / name for name in ("config.json", "generation_config.json", "tokenizer_config.json", "chat_template.jinja")),
)
DATA_ROUTES = {
    "results/inference-trace.json": "/data/inference-trace.json.gz",
    "results/smoke/results.json": "/data/experiment-smoke.json",
    "results/budget8192/results.json": "/data/experiment-budget8192.json",
}
HOME_PATH = str(Path.home())
PROJECT_PATH = str(ROOT)
PRIVATE_MARKERS = (PROJECT_PATH.encode(), HOME_PATH.encode())


def public_text(text):
    for prefix in (f"file://{PROJECT_PATH}/", f"{PROJECT_PATH}/"):
        text = text.replace(prefix, "")
    for prefix in (f"file://{PROJECT_PATH}", PROJECT_PATH):
        text = text.replace(prefix, ".")
    return text.replace(f"file://{HOME_PATH}", "local-home").replace(HOME_PATH, "local-home")


def public_json(value):
    if isinstance(value, str):
        return public_text(value)
    if isinstance(value, list):
        return [public_json(item) for item in value]
    if isinstance(value, dict):
        return {public_text(key): public_json(item) for key, item in value.items()}
    return value


def write_json(path, value, *, sanitize=True):
    if sanitize:
        value = public_json(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode()
    path.write_bytes(gzip.compress(payload, compresslevel=6, mtime=0) if path.suffix == ".gz" else payload)
    return len(payload)


def pinned_model_url(audit, filename):
    return f"https://huggingface.co/{audit['base_repo']}/resolve/{audit['base_revision']}/{quote(filename)}"


def write_sparse_patch(name, destination, change):
    before, spec = raw_array(name)
    after, _ = raw_array(name, "edited")
    before, after = before.reshape(-1), after.reshape(-1)
    if spec["dtype"] != "BF16" or before.size > 2**32:
        raise ValueError(f"Unsupported sparse patch tensor: {name}")
    if hashlib.sha256(before).hexdigest() != change["base_sha256"] or hashlib.sha256(after).hexdigest() != change["edited_sha256"]:
        raise ValueError(f"Tensor checksum does not match the verified checkpoint: {name}")
    indices = np.flatnonzero(before != after)
    if indices.size != change["changed_entries"]:
        raise ValueError(f"Sparse patch count does not match the verified diff: {name}")
    records = np.empty(indices.size, dtype=[("index", "<u4"), ("bits", "<u2")])
    records["index"], records["bits"] = indices, after[indices]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(records.tobytes())
    return len(records)


def weights_catalog(stage, audit):
    original, edited = MODELS["base"], MODELS["edited"]
    base_header, base_offset = HEADERS["base"]
    if HEADERS["base"] != HEADERS["edited"] or original.stat().st_size != edited.stat().st_size:
        raise ValueError("The verified patch must preserve the checkpoint header and file size")
    change_specs = {item["name"]: item for item in audit["changes"]}
    rows = {}
    changes = []
    for name, spec in base_header.items():
        if name == "__metadata__":
            continue
        start, end = (base_offset + offset for offset in spec["data_offsets"])
        rows[name] = {"start": start, "end": end, "absolute_offset": start,
                      "bytes": end - start, "dtype": spec["dtype"], "shape": spec["shape"]}
        if name not in change_specs:
            continue
        change = change_specs[name]
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
        patch_path = f"/data/patches/{safe_name}.sparse.bin"
        records = write_sparse_patch(name, stage / patch_path.lstrip("/"), change)
        rows[name]["patchPath"] = patch_path
        changes.append({"name": name, "start": start, "end": end, "path": patch_path,
                        "encoding": "sparse-bf16-le", "records": records, "baseSha256": change["base_sha256"],
                        "editedSha256": change["edited_sha256"]})
    changes.sort(key=lambda item: item["start"])
    if len(changes) != len(change_specs) or any(a["end"] > b["start"] for a, b in zip(changes, changes[1:])):
        raise ValueError("Patch ranges are missing or overlap")
    return {"fileSize": original.stat().st_size, "baseUrl": pinned_model_url(audit, original.name),
            "compressedData": list(COMPRESSED_DATA),
            "baseSha256": audit["base_file_sha256"], "editedSha256": audit["edited_file_sha256"],
            "changes": changes, "tensors": rows}


def chunks(array):
    flat = array.reshape(-1)
    for start in range(0, flat.size, CHUNK_VALUES):
        yield flat[start:start + CHUNK_VALUES]


def histogram_edges(low, high):
    if low == high:
        low, high = low - 0.000001, high + 0.000001
    return np.linspace(low, high, 65)


def histogram_result(edges, counts, size):
    total = int(counts.sum())
    if total != size:
        raise ValueError(f"Histogram covers {total} of {size} values")
    return {"edges": edges.tolist(), "counts": counts.tolist(), "total": total, "exact": True}


BF16_VALUES = floating(np.arange(65536, dtype=np.uint16), "BF16")


def exact_histogram(array, dtype, statistics):
    edges = histogram_edges(statistics["min"], statistics["max"])
    counts = np.zeros(64, dtype=np.int64)
    if dtype == "BF16":
        # Count exact stored bit patterns first. Each pattern has exactly one
        # decoded value, so binning the counts gives the same result as binning
        # every element. This keeps the embedding tensor scan memory bounded.
        bit_counts = np.zeros(65536, dtype=np.int64)
        for chunk in chunks(array):
            bit_counts += np.bincount(chunk, minlength=65536)
        active = bit_counts != 0
        counts = np.histogram(BF16_VALUES[active], bins=edges, weights=bit_counts[active])[0]
    else:
        for chunk in chunks(array):
            counts += np.histogram(floating(chunk, dtype), bins=edges)[0]
    return histogram_result(edges, counts, array.size)


def delta_histogram(before, after, dtype):
    def difference_chunks():
        for a, b in zip(chunks(before), chunks(after), strict=True):
            yield floating(b, dtype).astype(np.float64) - floating(a, dtype)

    low, high = float("inf"), -float("inf")
    for delta in difference_chunks():
        low, high = min(low, float(delta.min())), max(high, float(delta.max()))
    edges = histogram_edges(low, high)
    counts = np.zeros(64, dtype=np.int64)
    for delta in difference_chunks():
        counts += np.histogram(delta, bins=edges)[0]
    return histogram_result(edges, counts, before.size)


def histogram_catalog(tensors):
    result = {}
    for index, tensor in enumerate(tensors, 1):
        name, dtype = tensor["name"], tensor["dtype"]
        before, _ = raw_array(name)
        values = {"base": exact_histogram(before, dtype, tensor["statistics"])}
        if tensor["edited"]:
            after, _ = raw_array(name, "edited")
            values["edited"] = exact_histogram(after, dtype, tensor["statistics_edited"])
            values["delta"] = delta_histogram(before, after, dtype)
        result[name] = values
        if index % 64 == 0 or index == len(tensors):
            print(f"Exact histograms: {index}/{len(tensors)} tensors", flush=True)
    return result


def public_catalog(stage, routed_sizes, audit):
    model_paths = tuple(Path("models") / variant / name for variant in MODELS for name in MODEL_FILES)
    keys = [*model_paths, *PUBLIC_FILES]
    files = []
    assets_by_hash = {}
    for key in keys:
        source = ROOT / key
        if not source.exists() and key.name == "generation_config.json" and key.parts[0] == "models":
            continue
        if not source.is_file() or source.is_symlink() or not source.resolve().is_relative_to(ROOT):
            raise ValueError(f"Missing or unsafe release file: {key}")
        key_text = key.as_posix()
        if key_text in DATA_ROUTES:
            url = DATA_ROUTES[key_text]
            size = routed_sizes[key_text]
        elif key.parts[0] == "models" and key.name in REMOTE_MODEL_FILES:
            with source.open("rb") as f:
                digest = hashlib.file_digest(f, "sha256").hexdigest()
            if digest != audit["config_file_sha256"][key.name]:
                raise ValueError(f"Model asset does not match the pinned release: {key}")
            url = pinned_model_url(audit, key.name) + "?download=true"
            size = source.stat().st_size
        else:
            if key.suffix == ".npz":
                payload = source.read_bytes()
            else:
                payload = public_text(source.read_text(encoding="utf-8")).encode()
            digest = hashlib.sha256(payload).hexdigest()
            url = assets_by_hash.get(digest)
            if url is None:
                # Static assets ignore hidden paths. Keep the original key and
                # give the downloadable .gitattributes asset a visible filename.
                asset_key = key.with_name("gitattributes.txt") if key.name == ".gitattributes" else key
                url = "/files/" + quote(asset_key.as_posix())
                output = stage / "files" / asset_key
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(payload)
                assets_by_hash[digest] = url
            size = len(payload)
        files.append({"path": key_text, "bytes": size, "url": url})
    for checkpoint in MODELS.values():
        files.append({"path": checkpoint.relative_to(ROOT).as_posix(), "bytes": checkpoint.stat().st_size,
                      "url": None, "delivery": "checkpoint-stream"})
    return sorted(files, key=lambda item: item["path"])


def public_page(stage):
    page = (ROOT / "explorer/index.html").read_text()
    scripts = re.findall(r"<script>(.*?)</script>", page, flags=re.DOTALL)
    if len(scripts) != 1:
        raise ValueError("Expected one inline script in explorer/index.html")
    script = scripts[0]
    replacements = (
        (
            "async function api(path,query={}){const r=await fetch(path+'?'+new URLSearchParams(query));const d=await r.json();if(!r.ok)throw Error(d.error||r.statusText);return d;}",
            "async function api(path,query={}){return window.cloudApi(path,query);}",
        ),
        (
            "document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));",
            """function loadViewData(id){
    if(!O)return;
    if(id==='weights'&&!selected)loadTensors();
    if(id==='tokenizer'&&!vocabTotal)loadVocab();
    if(id==='runs'&&!runData)loadRun();
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
    setView(b.dataset.view);
    loadViewData(b.dataset.view);
});""",
        ),
        (
            "await loadTensors();await loadVocab();await loadRun();",
            "loadViewData(document.querySelector('nav button.active')?.dataset.view);",
        ),
        (
            "setView('weights');selectTensor(b.dataset.edit);",
            "$('tensorSearch').value='';$('tensorGroup').value='';setView('weights');loadTensors(b.dataset.edit);",
        ),
        (
            "+i+'.';setView('weights');loadTensors();",
            "+i+'.';$('tensorGroup').value='';selected=null;setView('weights');loadTensors();",
        ),
        (
            "async function loadTensors(){try{const sort=",
            "let tensorListRequestId=0;\nasync function loadTensors(preferredName){const id=++tensorListRequestId;try{const sort=",
        ),
        ("});T=d.tensors;", "});if(id!==tensorListRequestId)return;T=d.tensors;"),
        (
            "if(!selected){const target=T.find(t=>t.edited)||T[0];",
            "const preferred=typeof preferredName==='string'?T.find(t=>t.name===preferredName):null;"
            "if(preferred||!selected){const target=preferred||T.find(t=>t.edited)||T[0];",
        ),
        (
            "catch(e){$('tensorCount').textContent=e.message;}",
            "catch(e){if(id===tensorListRequestId)$('tensorCount').textContent=e.message;}",
        ),
    )
    for old, new in replacements:
        if script.count(old) != 1:
            raise ValueError(f"Explorer source changed near {old[:65]!r}. Update the static adapter.")
        script = script.replace(old, new)
    script = script.replace("读取本地权重", "读取权重").replace("读取本地真实记录", "读取真实推理记录")
    script = script.replace("按需计算全部 ", "已精确统计全部 ").replace("扫描全部张量值", "读取全量直方图")
    page = page.replace(f"<script>{scripts[0]}</script>", "")
    page = page.replace("</head>", '<script defer src="/cloud-api.js"></script>\n<script defer src="/explorer.js"></script>\n</head>')
    page = page.replace("逐层检查本地模型", "逐层检查模型").replace("本地 · 只读", "在线 · 只读")
    page = page.replace("全部可访问的本地发行文件与实验记录", "全部可访问的发行文件与实验记录")
    (stage / "index.html").write_text(public_text(page))
    (stage / "explorer.js").write_text(public_text(script))
    for name in ("cloud-api.js", "_headers"):
        source = ROOT / "cloudflare/src" / name
        if source.exists():
            shutil.copyfile(source, stage / name)


def build(stage):
    data = stage / "data"
    audit = json_file(ROOT / "results/weight_verification.json")
    visual = json_file(ROOT / "results/visual-data.json")
    inventory = json_file(ROOT / "results/model-inventory.json")
    statistics = json_file(ROOT / "results/tensor-statistics.json")
    base_statistics = {item["name"]: item["statistics"] for item in statistics["tensors"]}
    edited_statistics = {item["name"]: item["statistics"] for item in statistics["edited_overrides"]}
    expected_names = {t["name"] for t in visual["tensors"]}
    if set(base_statistics) != expected_names or len(base_statistics) != audit["verified_tensors"]:
        raise ValueError("Full tensor statistics are required; run export_visual_data.py --full first")
    if statistics["base_file_sha256"] != audit["base_file_sha256"] or statistics["edited_file_sha256"] != audit["edited_file_sha256"]:
        raise ValueError("Statistics refer to different checkpoints")
    weights = weights_catalog(stage, audit)
    tensors = []
    for t in sorted(visual["tensors"], key=lambda row: row["name"]):
        name = t["name"]
        tensors.append({**t, "data_offsets": HEADERS["base"][0][name]["data_offsets"],
                        "absolute_offset": weights["tensors"][name]["start"],
                        "statistics": base_statistics[name],
                        "statistics_edited": edited_statistics.get(name, base_statistics[name])})
    write_json(data / "tensors.json.gz", {"tensors": tensors, "total": len(tensors), "statistics_ready": len(base_statistics)})
    write_json(data / "metadata.json", {"headers": {key: value[0] for key, value in HEADERS.items()},
                                        "inventory": inventory, "statistics": statistics})
    routed_sizes = {source: write_json(stage / url.lstrip("/"), json_file(ROOT / source))
                    for source, url in DATA_ROUTES.items()}
    files = public_catalog(stage, routed_sizes, audit)
    weights["downloads"] = {item["path"]: item["url"] for item in files if item["url"] is not None}
    write_json(data / "weights.json", weights)
    write_json(data / "overview.json", {
        "visual": visual, "inventory": inventory, "statistics_summary": statistics["summary"],
        "statistics_ready": len(base_statistics), "config": json_file(ROOT / "models/base/config.json"),
        "tokenizer_config": json_file(ROOT / "models/base/tokenizer_config.json"),
        "chat_template": (ROOT / "models/base/chat_template.jinja").read_text(), "files": files,
    })
    # Vocabulary is exact model data and contains no machine-specific paths.
    write_json(data / "vocab.json.gz", vocabulary(), sanitize=False)
    write_json(data / "histograms.json.gz", histogram_catalog(tensors), sanitize=False)
    public_page(stage)


def validate(stage):
    total = 0
    count = 0
    for path in stage.rglob("*"):
        if not path.is_file():
            continue
        size = path.stat().st_size
        if size > ASSET_LIMIT:
            raise ValueError(f"Static asset exceeds 25 MiB: {path.relative_to(stage)} ({size} bytes)")
        if path.suffix not in (".bin", ".npz"):
            payload = path.read_bytes()
            if path.suffix == ".gz":
                payload = gzip.decompress(payload)
            if any(marker in payload for marker in PRIVATE_MARKERS):
                raise ValueError(f"Machine-specific path in public asset: {path.relative_to(stage)}")
        count += 1
        total += size
    return count, total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "cloudflare/dist")
    args = parser.parse_args()
    if args.output.is_symlink():
        parser.error("Output directory must not be a symlink")
    output = args.output.resolve()
    if output.exists() and not output.is_dir():
        parser.error("Output must be a directory")
    if output.exists() and any(output.iterdir()) and not all((output / name).is_file() for name in (
        "index.html", "explorer.js", "data/weights.json", "data/overview.json"
    )):
        parser.error("Refusing to replace a directory without an existing explorer build")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".cloudflare-build-", dir=output.parent) as temp:
        stage = Path(temp) / "dist"
        stage.mkdir()
        build(stage)
        count, total = validate(stage)
        previous = Path(temp) / "previous"
        if output.exists():
            output.rename(previous)
        try:
            stage.rename(output)
        except OSError:
            if previous.exists():
                previous.rename(output)
            raise
    print(f"Built {count} assets ({total:,} bytes) at {output}")


if __name__ == "__main__":
    main()
