// Headless page: runs the on-device tier on every eval image and returns per-image results.
import { EdgeClassifier } from '../src/router/edge';

declare global { interface Window { __run: () => Promise<unknown> } }

window.__run = async () => {
  const man = await (await fetch('/eval/manifest.json')).json();
  const t0 = performance.now();
  const clf = await EdgeClassifier.load(man.catalog, { localPath: '/models/', wasmPaths: '/node_modules/onnxruntime-web/dist/' });
  const loadMs = performance.now() - t0;
  const rows = [];
  for (const it of man.items) {
    const r = await clf.classify(`/eval/${it.file}`);
    rows.push({ file: it.file, label: it.label, inCatalog: it.inCatalog, pred: r.label, confidence: r.confidence, ms: r.ms });
  }
  return { loadMs, rows, threads: navigator.hardwareConcurrency };
};
