"""Cloud tier stand-in: a small open vision-language model behind an OpenAI-compatible
/v1/chat/completions endpoint, so llm-gateway (or any OpenAI-compatible provider) can replace it
without client changes.

Runs SmolVLM-256M-Instruct on CPU. Its latency is a proxy for "a remote model", not a figure for any
real cloud deployment.

Usage: uvicorn server.vlm_server:app --port 8095
"""
import base64
import io
import os
import time

import torch
from fastapi import FastAPI
from PIL import Image
from transformers import AutoModelForVision2Seq, AutoProcessor

MODEL = os.getenv("VLM_MODEL", "HuggingFaceTB/SmolVLM-256M-Instruct")
torch.set_num_threads(int(os.getenv("VLM_THREADS", "2")))
processor = AutoProcessor.from_pretrained(MODEL)
processor.image_processor.do_image_splitting = False  # one 512px tile: much faster on CPU
model = AutoModelForVision2Seq.from_pretrained(MODEL, torch_dtype=torch.float32).eval()
app = FastAPI()


def decode_image(url: str) -> Image.Image:
    if not url.startswith("data:"):
        raise ValueError("only data: URLs are accepted")
    return Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")


@app.post("/v1/chat/completions")
def chat(body: dict) -> dict:
    t0 = time.perf_counter()
    msg = body["messages"][-1]
    parts = msg["content"] if isinstance(msg["content"], list) else [{"type": "text", "text": msg["content"]}]
    images = [decode_image(p["image_url"]["url"]) for p in parts if p["type"] == "image_url"]
    text = " ".join(p["text"] for p in parts if p["type"] == "text")
    chat_msgs = [{"role": "user", "content": [*([{"type": "image"}] * len(images)), {"type": "text", "text": text}]}]
    prompt = processor.apply_chat_template(chat_msgs, add_generation_prompt=True)
    inputs = processor(text=prompt, images=images or None, return_tensors="pt")
    with torch.inference_mode():
        out = model.generate(**inputs, max_new_tokens=int(body.get("max_tokens", 16)), do_sample=False)
    answer = processor.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
    n_in, n_out = int(inputs["input_ids"].shape[1]), int(out.shape[1] - inputs["input_ids"].shape[1])
    return {"id": "local", "object": "chat.completion", "model": MODEL,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": answer}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": n_in, "completion_tokens": n_out, "total_tokens": n_in + n_out},
            "server_ms": round((time.perf_counter() - t0) * 1000, 1)}


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "model": MODEL}
