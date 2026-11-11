#!/usr/bin/env python3
"""Capture real inference tensors from a tiny, greedy local Qwen example."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from importlib.metadata import version
import json
from pathlib import Path
import platform
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", default="1 + 1 = ? Reply with only the number.")
    parser.add_argument("--answer", default="2", help="Reference answer for this small example")
    parser.add_argument("--max-tokens", type=int, default=8)
    parser.add_argument("--output", type=Path, default=ROOT / "results/inference-trace.json")
    args = parser.parse_args()
    if args.max_tokens < 1:
        parser.error("--max-tokens must be positive")

    import mlx.core as mx
    import mlx.nn as nn
    import numpy as np
    from mlx_lm import load
    from mlx_lm.models import qwen3_5 as q35

    started = time.perf_counter()
    model, tokenizer = load(str(ROOT / "models/base"))
    model.eval()
    core = model.language_model.model
    layers = core.layers
    layer_ids = {id(layer): i for i, layer in enumerate(layers)}
    attn_ids = {id(layer.linear_attn if layer.is_linear else layer.self_attn): i
                for i, layer in enumerate(layers)}
    mlp = layers[15].mlp
    linear_ids = {id(mlp.gate_proj): "gate", id(mlp.up_proj): "up", id(mlp.down_proj): "down"}
    norm_ids = {id(core.norm): "final_norm", id(layers[15].post_attention_layernorm): "mlp_norm"}
    prompt = tokenizer.apply_chat_template(
        [{"role": "user", "content": args.prompt}], tokenize=False,
        add_generation_prompt=True, enable_thinking=False,
    )
    prompt_ids = tokenizer.encode(prompt, add_special_tokens=False)
    hf = tokenizer._tokenizer
    offsets = hf(prompt, add_special_tokens=False, return_offsets_mapping=True)["offset_mapping"]

    def token_info(token_id):
        token_id = int(token_id)
        return {"id": token_id, "text": hf.decode([token_id], skip_special_tokens=False),
                "vocabulary_token": hf.convert_ids_to_tokens(token_id)}

    def summary(x):
        v = x[0, -1, :] if x.ndim == 3 else x.reshape(-1)
        v = v.astype(mx.float32)
        mx.eval(v)
        return {"norm": float(mx.linalg.norm(v)), "preview": v[:8].tolist(), "vector": v.tolist(),
                "width": int(v.size), "dtype": str(x.dtype), "shape": list(x.shape),
                "vector_scope": "last consumed position; complete feature width"}

    current = None
    original_layer = q35.DecoderLayer.__call__
    original_attentions = {cls: cls.__call__ for cls in (q35.GatedDeltaNet, q35.Attention)}
    original_linear = nn.Linear.__call__
    original_norm = nn.RMSNorm.__call__
    original_embedding = nn.Embedding.__call__

    def traced_layer(self, x, *a, **kw):
        out = original_layer(self, x, *a, **kw)
        if current is not None and id(self) in layer_ids:
            i = layer_ids[id(self)]
            current["layers"][i] = {"input": x, "output": out,
                                     "type": "linear_attention" if self.is_linear else "full_attention"}
        return out

    def attention_wrapper(cls, original):
        def call(self, x, *a, **kw):
            out = original(self, x, *a, **kw)
            if current is not None and id(self) in attn_ids:
                cache = kw.get("cache")
                state = getattr(cache, "state", None)
                shapes = [list(v.shape) for v in state if hasattr(v, "shape")] if isinstance(state, (tuple, list)) else []
                current["attention"][attn_ids[id(self)]] = {
                    "input": x, "output": out, "cache_type": type(cache).__name__,
                    "cache_shapes": shapes,
                }
            return out
        return call

    def traced_linear(self, x, *a, **kw):
        out = original_linear(self, x, *a, **kw)
        if current is not None and current["step"] == 0 and id(self) in linear_ids:
            current["mlp_detail"][linear_ids[id(self)]] = {"input": x, "output": out}
        return out

    def traced_norm(self, x, *a, **kw):
        out = original_norm(self, x, *a, **kw)
        if current is not None and id(self) in norm_ids:
            current[norm_ids[id(self)]] = {"input": x, "output": out}
        return out

    def traced_embedding(self, x, *a, **kw):
        out = original_embedding(self, x, *a, **kw)
        if current is not None and self is core.embed_tokens:
            current["embedding"] = out
        return out

    q35.DecoderLayer.__call__ = traced_layer
    for cls, original in original_attentions.items():
        cls.__call__ = attention_wrapper(cls, original)
    nn.Linear.__call__, nn.RMSNorm.__call__, nn.Embedding.__call__ = traced_linear, traced_norm, traced_embedding
    cache = model.language_model.make_cache()
    context, consumed, generated, steps = list(prompt_ids), list(prompt_ids), [], []
    prompt_tokens = []
    archive_arrays = {}
    first_logits = None
    try:
        for step in range(args.max_tokens):
            current = {"step": step, "layers": {}, "attention": {}, "mlp_detail": {}}
            tick = time.perf_counter()
            logits = model(mx.array([consumed]), cache=cache)[0, -1, :]
            mx.eval(logits)
            if step == 0:
                first_logits = logits
                embedding = current["embedding"][0].astype(mx.float32)
                mx.eval(embedding)
                archive_arrays["prompt_embeddings"] = np.asarray(embedding)
                for pos, token_id in enumerate(prompt_ids):
                    row = embedding[pos]
                    prompt_tokens.append({"position": pos, **token_info(token_id),
                                          "offset": list(offsets[pos]),
                                          "embedding": {"norm": float(mx.linalg.norm(row)), "preview": row[:8].tolist(),
                                                        "vector": row.tolist(), "width": int(row.size)}})
            probs = mx.softmax(logits.astype(mx.float32))
            order = mx.argsort(logits)[-10:][::-1]
            mx.eval(probs, order)
            chosen = int(mx.argmax(logits))
            archive_arrays[f"step_{step}_logits"] = np.asarray(logits.astype(mx.float32))
            archive_arrays[f"step_{step}_probabilities"] = np.asarray(probs)
            eos = chosen in tokenizer.eos_token_ids
            selected = {**token_info(chosen), "probability": float(probs[chosen]), "is_eos": eos}
            top = [{**token_info(int(t)), "logit": float(logits[int(t)]), "probability": float(probs[int(t)])}
                   for t in order.tolist()]
            layer_rows = []
            for i in range(24):
                value, att = current["layers"][i], current["attention"][i]
                ins, outs, ats = summary(value["input"]), summary(value["output"]), summary(att["output"])
                delta = value["output"][0, -1, :].astype(mx.float32) - value["input"][0, -1, :].astype(mx.float32)
                layer_rows.append({"layer": i, "type": value["type"],
                                   "input_norm": ins["norm"], "output_norm": outs["norm"],
                                   "residual_delta_norm": float(mx.linalg.norm(delta)),
                                   "input_preview": ins["preview"], "output_preview": outs["preview"],
                                   "input_vector": ins["vector"], "output_vector": outs["vector"],
                                   "attention": {"input_norm": summary(att["input"])["norm"],
                                                 "output_norm": ats["norm"], "output_preview": ats["preview"],
                                                 "input_vector": summary(att["input"])["vector"],
                                                 "output_vector": ats["vector"],
                                                 "cache_type": att["cache_type"], "cache_shapes": att["cache_shapes"]}})
                archive_arrays[f"step_{step}_layer_{i:02d}_input"] = np.array(ins["vector"], dtype=np.float32)
                archive_arrays[f"step_{step}_layer_{i:02d}_output"] = np.array(outs["vector"], dtype=np.float32)
            fn = current["final_norm"]
            fni, fno = summary(fn["input"]), summary(fn["output"])
            record = {"step": step, "phase": "prefill" if step == 0 else "decode",
                      "input_ids": consumed, "consumed_tokens": [token_info(t) for t in consumed],
                      "context_ids": list(context), "context_length": len(context), "input_position": len(context)-1,
                      "selected_token": selected, "top_tokens": top, "layers": layer_rows,
                      "embedding": summary(current["embedding"]),
                      "final_norm": {"input_norm": fni["norm"], "output_norm": fno["norm"],
                                     "input_preview": fni["preview"], "output_preview": fno["preview"],
                                     "input_vector": fni["vector"], "output_vector": fno["vector"]},
                      "lm_head": {"shared_embedding": True, "hidden_width": 1024, "vocabulary_rows": int(logits.size),
                                  "operation": "final_hidden @ embed_tokens.weight.T", "selected_logit": float(logits[chosen])},
                      "probability_sum": float(mx.sum(probs)), "instrumented_seconds": time.perf_counter()-tick}
            if step == 0:
                det = current["mlp_detail"]
                norm_in, norm_out = summary(current["mlp_norm"]["input"]), summary(current["mlp_norm"]["output"])
                record["mlp_detail"] = {"layer": 15, "method": "Captured actual Linear inputs/outputs around the fused SwiGLU; no recomputation",
                    "stages": [
                        {"name": "post_attention_residual", **norm_in},
                        {"name": "RMSNorm", **norm_out},
                        {"name": "gate_proj", **summary(det["gate"]["output"])},
                        {"name": "up_proj", **summary(det["up"]["output"])},
                        {"name": "fused_SwiGLU", **summary(det["down"]["input"])},
                        {"name": "down_proj", **summary(det["down"]["output"])}],
                    "weight_shapes": {"gate_proj": list(mlp.gate_proj.weight.shape),
                                      "up_proj": list(mlp.up_proj.weight.shape), "down_proj": list(mlp.down_proj.weight.shape)},
                    "formula": "down_proj(swiglu(gate_proj(RMSNorm(h)), up_proj(RMSNorm(h))))"}
            steps.append(record)
            print(f"step {step}: {selected['text']!r} (id={chosen}, p={selected['probability']:.6f}, eos={eos})", flush=True)
            if eos:
                break
            generated.append(chosen)
            context.append(chosen)
            consumed = [chosen]
            current = None
    finally:
        current = None
        q35.DecoderLayer.__call__ = original_layer
        for cls, original in original_attentions.items():
            cls.__call__ = original
        nn.Linear.__call__, nn.RMSNorm.__call__, nn.Embedding.__call__ = original_linear, original_norm, original_embedding

    # The observer wrappers only return the untouched original computation.
    untraced = model(mx.array([prompt_ids]), cache=model.language_model.make_cache())[0, -1, :]
    mx.eval(untraced)
    max_difference = float(mx.max(mx.abs(untraced.astype(mx.float32)-first_logits.astype(mx.float32))))
    assert max_difference == 0, f"Observer affected logits: {max_difference}"
    generated_text = hf.decode(generated, skip_special_tokens=False)
    assert steps and len(steps[0]["layers"]) == 24
    assert all(abs(s["probability_sum"]-1) < 1e-5 for s in steps)
    audit = json.loads((ROOT / "results/weight_verification.json").read_text())
    archive_path = args.output.with_name("inference-arrays.npz")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(archive_path, **archive_arrays)
    payload = {"schema_version": 1, "created_utc": datetime.now(timezone.utc).isoformat(),
        "example": {"user_message": args.prompt, "answer": args.answer}, "prompt": prompt, "prompt_tokens": prompt_tokens,
        "model": {"name": "Qwen/Qwen3.5-0.8B", "revision": audit["base_revision"],
                  "checkpoint_sha256": audit["base_file_sha256"], "hidden_size": 1024, "intermediate_size": 3584,
                  "num_layers": 24, "vocab_size": int(first_logits.size), "path": str(ROOT / "models/base")},
        "protocol": {"thinking": False, "selection": "greedy argmax", "temperature": 0,
                     "probability_scope": "untempered raw-logit softmax over all 248320 projected vocabulary rows before top-10 truncation; not a temperature-0 sampling distribution",
                     "max_new_tokens": args.max_tokens, "backend": "mlx_lm", "quantized": False,
                     "preview_scope": "First eight dimensions at the last consumed input position, not the not-yet-consumed selected output token",
                     "cache": "Prefill entire prompt once; decode consumes the preceding generated token with attention/GDN cache",
                     "path_scope": "Text path only; MLX sanitizer excludes vision and MTP from this example"},
        "array_archive": {"path": str(archive_path), "format": "NumPy NPZ, exact float32 values; BF16 hidden vectors decode losslessly to float32",
                          "contents": "All prompt embeddings; complete 248320 logits and probabilities for every step; all 24 layer last-position input/output vectors",
                          "arrays": list(archive_arrays), "bytes": archive_path.stat().st_size},
        "steps": steps, "generated_ids": generated, "generated_text": generated_text,
        "finish_reason": "eos" if steps[-1]["selected_token"]["is_eos"] else "length",
        "correct": generated_text.strip() == args.answer.strip(),
        "environment": {"python": sys.version, "platform": platform.platform(),
                        "packages": {name: version(name) for name in ("mlx", "mlx-lm", "transformers", "numpy")},
                        "total_instrumented_seconds": time.perf_counter()-started},
        "validation": {"untraced_first_step_max_abs_logit_difference": max_difference,
                       "all_24_layers_observed_each_step": True, "full_probability_sums_checked": True,
                       "observer_preserves_original_return_values": True,
                       "meaning": "Numeric forward-pass observations, not a decoded chain of thought or neuron semantics"}}
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    assert len(text.encode()) < 10_000_000, f"Trace payload too large: {len(text.encode())}"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text)
    print(f"{args.output}: {generated_text!r}, {payload['finish_reason']}, {len(text.encode()):,} bytes", flush=True)


if __name__ == "__main__":
    main()
