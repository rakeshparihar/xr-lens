// Entry: AR on devices that support it; otherwise the same pipeline on the camera feed in a page
// ("desktop fallback"): click on an object to ask what it is.
import manifest from '../public/eval/manifest.json';
import { EdgeClassifier } from './router/edge';
import { ask, cropAt } from './router/ask';
import { startAR } from './xr';

const params = new URLSearchParams(location.search);
const threshold = Number(params.get('threshold') ?? 0.6);
const cloudUrl = params.get('cloud') ?? '/v1';
const catalog: string[] = manifest.catalog;
const cloudLabels: string[] = [...manifest.catalog, ...manifest.outOfCatalog];
const status = document.querySelector<HTMLElement>('#status')!;
const log = document.querySelector<HTMLElement>('#log')!;

async function main() {
  status.textContent = 'Loading the on-device model…';
  // Where the on-device model comes from: the Hugging Face Hub by default, or a local copy set per environment
  // (.env.development points at public/models so development works offline).
  const env = import.meta.env;
  const edge = await EdgeClassifier.load(catalog, { localPath: env.VITE_MODEL_PATH || undefined, wasmPaths: env.VITE_ORT_WASM_PATH || undefined });
  const run = (c: HTMLCanvasElement, x: number, y: number) => ask(cropAt(c, c.width, c.height, x, y), edge, { threshold, cloudUrl, cloudLabels });
  const arOk = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false);
  if (arOk) {
    status.textContent = 'Ready. Tap "Start AR", aim the ring at an object and tap.';
    const b = document.querySelector<HTMLButtonElement>('#ar')!;
    b.hidden = false;
    b.onclick = () => startAR(run, document.querySelector('#overlay')!);
    return;
  }
  const video = document.querySelector<HTMLVideoElement>('#video')!;
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  await video.play();
  status.textContent = 'No AR on this device: click on an object in the video to ask what it is.';
  video.onclick = async (e) => {
    const r = video.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * video.videoWidth, y = ((e.clientY - r.top) / r.height) * video.videoHeight;
    const frame = document.createElement('canvas');
    frame.width = video.videoWidth; frame.height = video.videoHeight;
    frame.getContext('2d')!.drawImage(video, 0, 0);
    // Pin a label where the user clicked, like the AR anchor does in a headset or phone.
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.style.left = `${((e.clientX - r.left) / r.width) * 100}%`;
    tag.style.top = `${((e.clientY - r.top) / r.height) * 100}%`;
    tag.textContent = '…';
    document.querySelector('.stage')!.appendChild(tag);
    const a = await run(frame, x, y);
    tag.textContent = `${a.label ?? 'not sure'} · ${a.tier}`;
    tag.classList.add(a.tier);
    const li = document.createElement('li');
    li.textContent = `${a.label ?? 'not sure'} · ${a.tier} · confidence ${a.confidence.toFixed(2)} · ${Math.round(a.edgeMs + (a.cloudMs ?? 0))} ms · ${a.bytesSent} bytes sent`;
    log.prepend(li);
  };
}
main().catch((e) => { status.textContent = `Could not start: ${e.message}`; });
