// Runs bench/edge.html in headless Chromium; writes bench/results/edge.json.
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const server = await createServer({ server: { port: 5198 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
await page.goto('http://localhost:5198/bench/edge.html');
await page.waitForFunction(() => typeof window.__run === 'function');
const out = await page.evaluate(() => window.__run());
const sizes = Object.fromEntries(out.rows.map((r) => [r.file, fs.statSync(`public/eval/${r.file}`).size]));
fs.writeFileSync('bench/results/edge.json', JSON.stringify({ date: new Date().toISOString().slice(0, 10), model: 'Xenova/siglip-base-patch16-224 (q8), Transformers.js 3.1.2, WASM, headless Chromium', ...out, jpegBytes: sizes }, null, 2) + '\n');
await browser.close();
await server.close();
const acc = (f) => { const s = out.rows.filter(f); return (s.filter((r) => r.pred === r.label).length / s.length).toFixed(3); };
console.log('edge in-catalog accuracy', acc((r) => r.inCatalog), 'load ms', Math.round(out.loadMs));
