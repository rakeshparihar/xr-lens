// The routing policy: answer on the device when it is confident enough, otherwise send the crop to
// the cloud tier. One threshold sets the trade-off between accuracy, latency and bytes sent.
export type Route = 'edge' | 'cloud';

export function route(edgeConfidence: number, threshold: number): Route {
  return edgeConfidence >= threshold ? 'edge' : 'cloud';
}

export interface Item { label: string; inCatalog: boolean; edgePred: string; edgeConf: number; edgeMs: number; cloudPred: string | null; cloudMs: number; cloudBytes: number }

export interface Point { threshold: number; accuracy: number; accuracyIn: number; accuracyOut: number; escalated: number; escalatedOut: number; p50Ms: number; p95Ms: number; kbPerQuery: number }

const q = (v: number[], p: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };

/** Accuracy, escalation rate, latency and bytes for one threshold. Escalated queries pay the edge pass and the cloud call. */
export function evaluate(items: Item[], threshold: number): Point {
  const out = items.map((it) => {
    const r = route(it.edgeConf, threshold);
    const pred = r === 'edge' ? it.edgePred : it.cloudPred;
    return { r, ok: pred === it.label, ms: it.edgeMs + (r === 'cloud' ? it.cloudMs : 0), bytes: r === 'cloud' ? it.cloudBytes : 0, inCatalog: it.inCatalog };
  });
  const acc = (f: (o: typeof out[number]) => boolean) => { const s = out.filter(f); return s.length ? s.filter((o) => o.ok).length / s.length : NaN; };
  const outOf = out.filter((o) => !o.inCatalog);
  return {
    threshold, accuracy: acc(() => true), accuracyIn: acc((o) => o.inCatalog), accuracyOut: acc((o) => !o.inCatalog),
    escalated: out.filter((o) => o.r === 'cloud').length / out.length,
    escalatedOut: outOf.length ? outOf.filter((o) => o.r === 'cloud').length / outOf.length : NaN,
    p50Ms: q(out.map((o) => o.ms), 0.5), p95Ms: q(out.map((o) => o.ms), 0.95),
    kbPerQuery: out.reduce((a, o) => a + o.bytes, 0) / out.length / 1024,
  };
}
