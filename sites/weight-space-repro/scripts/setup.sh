#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
if [ "$#" -gt 1 ]; then
  echo 'Usage: bash scripts/setup.sh [--build-only]' >&2
  exit 2
fi
case "${1:-}" in
  '') requirements=requirements.lock ;;
  --build-only) requirements=requirements-build.lock ;;
  *) echo 'Usage: bash scripts/setup.sh [--build-only]' >&2; exit 2 ;;
esac
command -v uv >/dev/null || { echo 'Please install uv first: https://docs.astral.sh/uv/'; exit 1; }
if [ ! -x .venv/bin/python ]; then
  uv --cache-dir "$root/.cache/uv" venv --python 3.12 .venv
fi
uv --cache-dir "$root/.cache/uv" pip sync --python .venv/bin/python "$requirements"
revision=4d09ba6d6a7e891dd8063974dfe81b3d78e3494f
upstream="$root/upstream/lm_understand-logs"
if [ ! -d "$upstream/.git" ]; then
  if [ -e "$upstream" ]; then
    echo "Expected a Git checkout at $upstream" >&2
    exit 1
  fi
  mkdir -p "$root/upstream"
  checkout="$(mktemp -d "$root/upstream/.checkout.XXXXXX")"
  trap 'rm -rf "$checkout"' EXIT
  git clone --filter=blob:none --no-checkout --no-tags https://github.com/RikiyaT/lm_understand-logs.git "$checkout"
  git -C "$checkout" sparse-checkout set --cone \
    exp8_math/code \
    exp8_math/base_model/Qwen3.5-0.8B-text \
    exp8_math/runs/p50c/edit
  git -C "$checkout" checkout --detach "$revision"
  mv "$checkout" "$upstream"
  trap - EXIT
fi
actual="$(git -C "$upstream" rev-parse HEAD)"
if [ "$actual" != "$revision" ]; then
  echo "Unexpected upstream commit: $actual (expected $revision)" >&2
  exit 1
fi
echo 'Ready. Run: .venv/bin/python scripts/prepare.py'
