# ADR 1: The edge/cloud routing policy is the product; the WebXR shell stays thin

## Status

Accepted (decided by a judge after two advocates argued).

## Context

The brief is "point and ask" in WebXR: isolate an object, identify it, anchor a label. The build machine has headless Chromium only, with no AR device, camera or GPU, and no paid model APIs.

- **Advocate A:** build the full WebXR app (hit-test, anchors, tap, crop, segmentation, then a server-side VLM behind an OpenAI-compatible endpoint), plus a desktop fallback that runs the same stages on stills. Measure per-stage latency, masked versus unmasked crops, and bytes saved.
- **Advocate B:** make the split between edge and cloud the product. Zero-shot SigLIP on the device answers when it is confident; otherwise the query escalates to a cloud VLM. Sweep the confidence threshold and report accuracy, latency and bytes, with out-of-catalog items reported separately.

## Decision (judge)

B wins, and A's pipeline becomes the escalation path.

1. The router runs SigLIP through Transformers.js against the catalog labels. It answers on the device when confidence is at or above a threshold `t`, and otherwise escalates to a small open VLM behind an OpenAI-compatible endpoint, the seam where llm-gateway attaches.
2. Sweep `t` on a fixed labelled set and report accuracy, p50 and p95 latency, and bytes sent. Report out-of-catalog items as a separate split.
3. Masked versus unmasked crops (MediaPipe interactive segmenter) only if time allows. For v0.1 it did not, so it is the first item in v0.2.
4. Label the VLM's CPU latency as a proxy. Publish only numbers that were actually measured.
5. Keep the WebXR shell thin (hit-test, anchor, tap, camera access). Mark it as untested on a device, and make no per-frame claims from it.
