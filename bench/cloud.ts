// Runs the cloud tier once per eval image (the answer does not depend on the routing threshold, so the
// sweep can reuse it). Writes bench/results/cloud.json. Usage: npx vite-node bench/cloud.ts
import fs from 'node:fs';
import { askCloud } from '../src/router/cloud';
import { matchLabel } from '../src/router/labels';

const man = JSON.parse(fs.readFileSync('public/eval/manifest.json', 'utf8'));
const all: string[] = [...man.catalog, ...man.outOfCatalog];
const url = process.env.CLOUD_URL || 'http://127.0.0.1:8095/v1';
const rows: any[] = [];
for (const it of man.items) {
  const b64 = fs.readFileSync(`public/eval/${it.file}`).toString('base64');
  const a = await askCloud(url, b64, all, (process.env.PROMPT_MODE as 'open' | 'choice') ?? 'open');
  const pred = matchLabel(a.raw, all);
  rows.push({ file: it.file, label: it.label, inCatalog: it.inCatalog, raw: a.raw, pred, correct: pred === it.label, ms: a.ms, requestBytes: a.requestBytes });
  if (rows.length % 20 === 0) console.log(rows.length, 'done');
}
fs.writeFileSync('bench/results/cloud.json', JSON.stringify({ date: new Date().toISOString().slice(0, 10), model: `${process.env.VLM_NAME ?? 'HuggingFaceTB/SmolVLM-500M-Instruct'} (CPU, 2 threads, proxy for a cloud VLM), ${process.env.PROMPT_MODE ?? 'open'} prompt`, labels: all, rows }, null, 2) + '\n');
const acc = (f: (r: any) => boolean) => { const s = rows.filter(f); return (s.filter((r) => r.correct).length / s.length).toFixed(3); };
console.log('cloud accuracy in-catalog', acc((r) => r.inCatalog), 'out-of-catalog', acc((r) => !r.inCatalog));
