// Records the real app (desktop fallback) with Chromium's fake camera playing a video file:
// clicks each object in the scene and waits for the answer to appear in the log.
// Needs `npm run dev` on :5173 (with the cloud tier behind /v1) and a camera video.
// Usage: node scripts/record_demo.mjs path/to/scene.y4m path/to/scene.json
import { createRequire } from 'node:module';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [video, sceneJson] = process.argv.slice(2);
const scene = JSON.parse(fs.readFileSync(sceneJson, 'utf8'));
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 900 }, permissions: ['camera'], recordVideo: { dir: 'docs/img/.rec', size: { width: 960, height: 900 } } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/?threshold=0.6');
await page.waitForFunction(() => document.querySelector('#status')?.textContent?.startsWith('No AR'), null, { timeout: 300000 });
await page.waitForTimeout(800);
const box = await page.locator('#video').boundingBox();
for (const [i, it] of scene.items.entries()) {
  const [x, y] = it.center;
  await page.mouse.click(box.x + (x / scene.size[0]) * box.width, box.y + (y / scene.size[1]) * box.height);
  await page.waitForFunction((n) => document.querySelectorAll('#log li').length > n, i, { timeout: 120000 });
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: 'docs/img/app.png' });
const v = page.video();
await ctx.close();
fs.renameSync(await v.path(), 'docs/img/demo.webm');
await browser.close();
