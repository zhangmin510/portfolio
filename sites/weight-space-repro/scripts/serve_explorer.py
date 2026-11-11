#!/usr/bin/env python3
"""Read-only local explorer for every tensor, configuration and tokenizer entry."""
from __future__ import annotations
import argparse
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
from pathlib import Path
import re
import struct
from urllib.parse import parse_qs, urlsplit, quote
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DTYPES = {"BF16": "<u2", "F32": "<f4", "F16": "<f2", "F64": "<f8", "I64": "<i8", "I32": "<i4", "I16": "<i2", "I8": "i1", "U8": "u1", "BOOL": "?"}
MODELS = {k: next((ROOT / "models" / k).glob("*.safetensors")) for k in ("base", "edited")}
if any(p.is_symlink() or not p.resolve().is_relative_to(ROOT / "models" / k) for k, p in MODELS.items()):
    raise ValueError("Checkpoint must be an ordinary file inside the model directory")

def json_file(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default

def text_document(path):
    return path.suffix.lower() in (".json", ".md", ".txt", ".jinja", ".lock") or path.name in ("LICENSE", ".gitattributes")

def read_header(path):
    with path.open("rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        return json.loads(f.read(n)), n + 8

HEADERS = {k: read_header(p) for k, p in MODELS.items()}

def raw_array(name, variant="base"):
    if variant not in MODELS:
        raise ValueError("variant must be base or edited")
    header, off = HEADERS[variant]
    if name not in header or name == "__metadata__":
        raise ValueError("Unknown tensor name")
    spec = header[name]
    return np.memmap(MODELS[variant], mode="r", dtype=DTYPES[spec["dtype"]],
                     offset=off + spec["data_offsets"][0], shape=tuple(spec["shape"])), spec

def floating(raw, dtype):
    if dtype == "BF16":
        return (np.asarray(raw, dtype=np.uint32) << 16).view(np.float32)
    return np.asarray(raw)

def statistics():
    d = json_file(ROOT / "results/tensor-statistics.json", {})
    return {t["name"]: t for t in d.get("tensors", [])}, d

def catalog():
    paths = []
    for group in ("models/base", "models/edited", "results", "upstream/lm_understand-logs/exp8_math/base_model/Qwen3.5-0.8B-text"):
        directory = ROOT / group
        if directory.exists():
            paths += [p for p in directory.iterdir() if p.is_file() and (not p.name.startswith(".") or p.name == ".gitattributes")]
    for run in ("smoke", "budget8192"):
        paths += [p for p in (ROOT / "results" / run).glob("*") if p.is_file()]
    paths += [p for p in (ROOT / "README.md", ROOT / "REPORT.md", ROOT / "requirements.lock") if p.exists()]
    return {str(p.relative_to(ROOT)): p for p in paths
            if not p.is_symlink() and p.resolve().is_relative_to(ROOT)
            and all(not part.startswith(".") or part == ".gitattributes" for part in p.relative_to(ROOT).parts)
            and all(not part.startswith(".") or part == ".gitattributes" for part in p.resolve().relative_to(ROOT).parts)}

@lru_cache(maxsize=1)
def vocabulary():
    d = json_file(ROOT / "models/base/tokenizer.json")
    vocab = d.get("model", {}).get("vocab", {})
    rows = [{"id": int(v), "token": k, "added": False, "sources": ["tokenizer.json: model.vocab"]} for k, v in vocab.items()]
    by_id = {r["id"]: r for r in rows}
    for t in d.get("added_tokens", []):
        by_id[t["id"]] = {"id": t["id"], "token": t["content"], "added": True, "special": t.get("special", False), "metadata": t, "sources": ["tokenizer.json: added_tokens"]}
    config = json_file(ROOT / "models/base/tokenizer_config.json")
    for token_id, t in config.get("added_tokens_decoder", {}).items():
        token_id = int(token_id)
        if token_id in by_id:
            by_id[token_id]["sources"].append("tokenizer_config.json: added_tokens_decoder")
            by_id[token_id]["config_metadata"] = t
        else:
            by_id[token_id] = {"id": token_id, "token": t["content"], "added": True,
                               "special": t.get("special", False), "config_only": True,
                               "config_metadata": t, "sources": ["tokenizer_config.json: added_tokens_decoder"]}
    return sorted(by_id.values(), key=lambda r: r["id"])

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_json(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def send_file(self, path, *, start=0, length=None, attachment=False, filename=None):
        length = path.stat().st_size - start if length is None else length
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream" if attachment else mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(length))
        self.send_header("X-Content-Type-Options", "nosniff")
        if attachment:
            self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + quote(filename or path.name))
        self.end_headers()
        with path.open("rb") as f:
            f.seek(start)
            while length:
                block = f.read(min(length, 1024 * 1024))
                if not block:
                    break
                self.wfile.write(block)
                length -= len(block)

    def do_GET(self):
        # Same-origin local UI only; no remote binding and no arbitrary filesystem access.
        u = urlsplit(self.path)
        q = {k: v[-1] for k, v in parse_qs(u.query).items()}
        try:
            if u.path in ("/", "/index.html"):
                return self.send_file(ROOT / "explorer/index.html")
            if u.path == "/api/overview":
                visual = json_file(ROOT / "results/visual-data.json", {})
                stats, sd = statistics()
                return self.send_json({"visual": visual, "inventory": json_file(ROOT / "results/model-inventory.json"),
                                       "statistics_summary": sd.get("summary"), "statistics_ready": len(stats),
                                       "config": json_file(ROOT / "models/base/config.json"),
                                       "tokenizer_config": json_file(ROOT / "models/base/tokenizer_config.json"),
                                       "chat_template": (ROOT / "models/base/chat_template.jinja").read_text(),
                                       "files": [{"path": k, "bytes": p.stat().st_size} for k, p in catalog().items()]})
            if u.path == "/api/inference-trace":
                return self.send_json(json_file(ROOT / "results/inference-trace.json",
                                                {"status": "not_run", "steps": []}))
            if u.path == "/api/metadata":
                return self.send_json({"headers": {k: h[0] for k, h in HEADERS.items()},
                                       "inventory": json_file(ROOT / "results/model-inventory.json"),
                                       "statistics": json_file(ROOT / "results/tensor-statistics.json")})
            if u.path == "/api/document":
                paths = catalog()
                path = paths.get(q.get("file"))
                if path is None or not text_document(path) or path.stat().st_size > 2_000_000:
                    raise ValueError("Document must be an allowed text file smaller than 2MB; use download for larger files")
                return self.send_json({"file": q["file"], "text": path.read_text()})
            if u.path == "/api/tensors":
                tensors = json_file(ROOT / "results/visual-data.json")["tensors"]
                stat, sd = statistics()
                overrides = {t["name"]: t.get("statistics") for t in sd.get("edited_overrides", [])}
                rows = []
                for t in tensors:
                    if q.get("q", "").lower() not in t["name"].lower():
                        continue
                    if q.get("group") and t["group"] != q["group"]:
                        continue
                    spec = HEADERS["base"][0][t["name"]]
                    rows.append({**t, "data_offsets": spec["data_offsets"], "absolute_offset": HEADERS["base"][1] + spec["data_offsets"][0],
                                 "statistics": stat.get(t["name"], {}).get("statistics"),
                                 "statistics_edited": overrides.get(t["name"], stat.get(t["name"], {}).get("statistics"))})
                key = q.get("sort", "name")
                if key not in ("name", "params", "bytes", "dtype"):
                    key = "name"
                rows.sort(key=lambda t: t[key], reverse=q.get("order") == "desc")
                return self.send_json({"tensors": rows, "total": len(rows), "statistics_ready": len(stat)})
            if u.path == "/api/slice":
                name = q["name"]
                variant = q.get("variant", "base")
                if variant not in ("base", "edited", "delta"):
                    raise ValueError("Unknown variant")
                original, spec = raw_array(name)
                shape = spec["shape"]
                ncols = shape[-1] if shape else 1
                nrows = int(original.size // ncols)
                row, col = int(q.get("row", 0)), int(q.get("col", 0))
                rows, cols = int(q.get("rows", 48)), int(q.get("cols", 64))
                rs, cs = int(q.get("row_stride", 1)), int(q.get("col_stride", 1))
                if not (0 <= row < nrows and 0 <= col < ncols and 1 <= rows <= 256 and 1 <= cols <= 256 and rs >= 1 and cs >= 1):
                    raise ValueError("Slice out of range; rows/cols must be 1..256")
                ri, ci = np.arange(row, min(nrows, row + rows * rs), rs), np.arange(col, min(ncols, col + cols * cs), cs)
                a = np.asarray(original).reshape(nrows, ncols)[np.ix_(ri, ci)]
                other, _ = raw_array(name, "edited")
                b = np.asarray(other).reshape(nrows, ncols)[np.ix_(ri, ci)]
                av, bv = floating(a, spec["dtype"]), floating(b, spec["dtype"])
                values = av if variant == "base" else bv if variant == "edited" else bv.astype(np.float64) - av
                # Real model tensors are finite; represent nonfinite values as strings if encountered.
                def serial(arr):
                    return [[float(v) if np.isfinite(v) else str(v) for v in line] for line in arr]
                raw_a = np.ascontiguousarray(a).view(np.dtype("u" + str(a.dtype.itemsize)))
                raw_b = np.ascontiguousarray(b).view(np.dtype("u" + str(b.dtype.itemsize)))
                return self.send_json({"name": name, "dtype": spec["dtype"], "shape": shape, "matrix_shape": [nrows, ncols],
                                       "row_indices": ri.tolist(), "column_indices": ci.tolist(), "variant": variant,
                                       "values": serial(values), "base_values": serial(av), "edited_values": serial(bv),
                                       "base_bits": raw_a.tolist(), "edited_bits": raw_b.tolist(),
                                       "bit_width": a.dtype.itemsize * 8, "sampling": "actual indexed values; no averaging"})
            if u.path == "/api/histogram":
                name, variant = q["name"], q.get("variant", "base")
                if variant not in ("base", "edited", "delta"):
                    raise ValueError("Unknown variant")
                a, spec = raw_array(name)
                b, _ = raw_array(name, "edited")
                stat, sd = statistics()
                target_stats = stat.get(name, {}).get("statistics")
                if variant == "edited":
                    target_stats = next((x["statistics"] for x in sd.get("edited_overrides", []) if x["name"] == name), target_stats)
                if variant == "delta":
                    # The visualization payload rounds display statistics. Compute real
                    # extrema so no edge values fall outside the exact histogram bins.
                    low, high = math.inf, -math.inf
                    for start in range(0, a.size, 524288):
                        av = floating(a.reshape(-1)[start:start + 524288], spec["dtype"])
                        bv = floating(b.reshape(-1)[start:start + 524288], spec["dtype"])
                        delta = bv.astype(np.float64) - av
                        low, high = min(low, float(delta.min())), max(high, float(delta.max()))
                elif target_stats:
                    low, high = target_stats["min"], target_stats["max"]
                else:
                    low, high = math.inf, -math.inf
                    for start in range(0, a.size, 524288):
                        v = floating((a if variant == "base" else b).reshape(-1)[start:start + 524288], spec["dtype"])
                        low, high = min(low, float(v.min())), max(high, float(v.max()))
                if low == high:
                    low, high = low - 0.000001, high + 0.000001
                edges = np.linspace(low, high, 65)
                counts = np.zeros(64, dtype=np.int64)
                for start in range(0, a.size, 524288):
                    av = floating(a.reshape(-1)[start:start + 524288], spec["dtype"])
                    if variant != "base":
                        bv = floating(b.reshape(-1)[start:start + 524288], spec["dtype"])
                        av = bv if variant == "edited" else bv.astype(np.float64) - av
                    counts += np.histogram(av, bins=edges)[0]
                if int(counts.sum()) != int(a.size):
                    raise ValueError("Histogram does not cover every tensor value")
                return self.send_json({"edges": edges.tolist(), "counts": counts.tolist(), "total": int(counts.sum()), "exact": True})
            if u.path == "/api/vocab":
                rows = vocabulary()
                search = q.get("q", "")
                if search:
                    rows = [r for r in rows if str(r["id"]) == search or search.casefold() in r["token"].casefold()]
                offset = max(0, int(q.get("offset", 0)))
                limit = min(500, max(1, int(q.get("limit", 100))))
                return self.send_json({"total": len(rows), "offset": offset, "limit": limit, "rows": rows[offset:offset + limit]})
            if u.path == "/api/experiment":
                run = q.get("run", "smoke")
                if run not in ("smoke", "budget8192"):
                    raise ValueError("Unknown run")
                return self.send_json(json_file(ROOT / "results" / run / "results.json", {"status": "not_run"}))
            if u.path == "/api/tensor.bin":
                name, variant = q["name"], q.get("variant", "base")
                if variant not in MODELS:
                    raise ValueError("Raw tensor export supports base or edited")
                spec = HEADERS[variant][0][name]
                start, end = spec["data_offsets"]
                filename = re.sub(r"[^A-Za-z0-9._-]", "_", name) + "." + variant + "." + spec["dtype"].lower() + ".bin"
                return self.send_file(MODELS[variant], start=HEADERS[variant][1] + start, length=end-start, attachment=True, filename=filename)
            if u.path == "/download":
                paths = catalog()
                if q.get("file") not in paths:
                    raise ValueError("File is not in the explicit download catalog")
                return self.send_file(paths[q["file"]], attachment=True)
            return self.send_json({"error": "Not found"}, 404)
        except (BrokenPipeError, ConnectionResetError):
            return
        except (KeyError, ValueError, FileNotFoundError) as e:
            return self.send_json({"error": str(e)}, 400)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Qwen weight explorer: http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
