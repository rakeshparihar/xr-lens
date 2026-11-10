// One "point and ask" query: on-device first, cloud only when the device is unsure.
import { EdgeClassifier } from './edge';
import { askCloud } from './cloud';
import { matchLabel } from './labels';
import { route } from './router';

export interface Answer { label: string | null; raw?: string; tier: 'edge' | 'cloud'; confidence: number; edgeMs: number; cloudMs?: number; bytesSent: number }

export async function ask(crop: HTMLCanvasElement, edge: EdgeClassifier, opts: { threshold: number; cloudUrl: string; cloudLabels: string[] }): Promise<Answer> {
  const e = await edge.classify(crop.toDataURL('image/jpeg', 0.9));
  if (route(e.confidence, opts.threshold) === 'edge') return { label: e.label, tier: 'edge', confidence: e.confidence, edgeMs: e.ms, bytesSent: 0 };
  const b64 = crop.toDataURL('image/jpeg', 0.85).split(',')[1];
  const c = await askCloud(opts.cloudUrl, b64, opts.cloudLabels);
  return { label: matchLabel(c.raw, opts.cloudLabels), raw: c.raw, tier: 'cloud', confidence: e.confidence, edgeMs: e.ms, cloudMs: c.ms, bytesSent: c.requestBytes };
}

/** Square crop centred on (x, y) in a source of size w x h, drawn into a 224 x 224 canvas. */
export function cropAt(src: CanvasImageSource, w: number, h: number, x: number, y: number, frac = 0.45): HTMLCanvasElement {
  const side = Math.round(Math.min(w, h) * frac);
  const sx = Math.max(0, Math.min(w - side, Math.round(x - side / 2))), sy = Math.max(0, Math.min(h - side, Math.round(y - side / 2)));
  const c = document.createElement('canvas');
  c.width = c.height = 224;
  c.getContext('2d')!.drawImage(src, sx, sy, side, side, 0, 0, 224, 224);
  return c;
}
