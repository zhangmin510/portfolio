#!/usr/bin/env python3
"""Restore the public experiment records required to rebuild the website."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from urllib.parse import urljoin


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"


def sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def restore(base_url, artifact):
    destination = ROOT / artifact["target"]
    if destination.is_symlink() or not destination.resolve().is_relative_to(RESULTS):
        raise ValueError(f"Reference target is outside results: {artifact['target']}")
    if destination.is_file():
        if sha256(destination.read_bytes()) != artifact["output_sha256"]:
            raise ValueError(f"Existing result differs from the public reference: {artifact['target']}")
        print(f"Verified {artifact['target']}", flush=True)
        return

    url = urljoin(base_url, artifact["path"])
    response = subprocess.run([
        "curl", "--disable", "--fail", "--silent", "--show-error",
        "--proto", "=https", "--connect-timeout", "15", "--max-time", "60",
        "--max-filesize", str(artifact["bytes"]), "--header", "Accept-Encoding: identity", url,
    ], check=True, stdout=subprocess.PIPE)
    archive = response.stdout
    if len(archive) != artifact["bytes"] or sha256(archive) != artifact["sha256"]:
        raise ValueError(f"Published reference changed: {artifact['path']}")

    payload = gzip.decompress(archive) if artifact["compression"] == "gzip" else archive
    if sha256(payload) != artifact["output_sha256"]:
        raise ValueError(f"Unexpected restored bytes: {artifact['target']}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=".reference-", delete=False) as handle:
        pending = Path(handle.name)
        try:
            handle.write(payload)
            handle.close()
            # A second invocation must not replace a result created in parallel.
            try:
                destination.hardlink_to(pending)
            except FileExistsError:
                if sha256(destination.read_bytes()) != artifact["output_sha256"]:
                    raise
        finally:
            pending.unlink()
    print(f"Restored {artifact['target']}", flush=True)


def main():
    manifest = json.loads((ROOT / "data/published-reference.json").read_text(encoding="utf-8"))
    for artifact in manifest["artifacts"]:
        restore(manifest["base_url"], artifact)


if __name__ == "__main__":
    main()
