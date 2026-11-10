// On-device tier: zero-shot SigLIP (quantized ONNX) in the browser with Transformers.js.
// The catalog's label embeddings are computed once; each query then costs one vision forward pass.
import { softmax } from './softmax';
import { AutoProcessor, AutoTokenizer, RawImage, SiglipTextModel, SiglipVisionModel, env } from '@huggingface/transformers';

export const PROMPT_NAMES: Record<string, string> = {
  Tshirts: 't-shirt', Shirts: 'shirt', 'Casual Shoes': 'casual shoes', Watches: 'wrist watch', 'Sports Shoes': 'sports shoes',
  Kurtas: 'kurta', Tops: "women's top", Handbags: 'handbag', Heels: 'high heels', Sunglasses: 'sunglasses', Wallets: 'wallet',
  'Flip Flops': 'flip flops', Sandals: 'sandals', Briefs: 'briefs underwear', Belts: 'belt',
};

export interface EdgeResult { label: string; confidence: number; ms: number; scores: number[] }

export class EdgeClassifier {
  private constructor(private vision: any, private processor: any, private textEmb: Float32Array[], readonly labels: string[], private temperature: number) {}

  static async load(labels: string[], opts: { modelId?: string; localPath?: string; wasmPaths?: string; temperature?: number } = {}) {
    const id = opts.modelId ?? 'Xenova/siglip-base-patch16-224';
    if (opts.localPath) { env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = opts.localPath; }
    if (opts.wasmPaths) (env.backends.onnx as any).wasm.wasmPaths = opts.wasmPaths;
    const [processor, tokenizer, vision, text] = await Promise.all([
      AutoProcessor.from_pretrained(id, {}), AutoTokenizer.from_pretrained(id),
      SiglipVisionModel.from_pretrained(id, { dtype: 'q8' }), SiglipTextModel.from_pretrained(id, { dtype: 'q8' }),
    ]);
    const prompts = labels.map((l) => `a photo of a ${PROMPT_NAMES[l] ?? l.toLowerCase()}`);
    const tok = tokenizer(prompts, { padding: 'max_length', truncation: true });
    const { pooler_output } = await text(tok);
    const dim = pooler_output.dims[1];
    const emb = Array.from({ length: labels.length }, (_, i) => normalize(pooler_output.data.slice(i * dim, (i + 1) * dim)));
    await text.dispose?.(); // the text tower is only needed once; on a phone the embeddings would ship precomputed
    return new EdgeClassifier(vision, processor, emb, labels, opts.temperature ?? 100);
  }

  async classify(image: RawImage | string): Promise<EdgeResult> {
    const t0 = performance.now();
    const img = typeof image === 'string' ? await RawImage.read(image) : image;
    const inputs = await this.processor(img);
    const { pooler_output } = await this.vision(inputs);
    const v = normalize(pooler_output.data);
    const scores = softmax(this.textEmb.map((t) => this.temperature * dot(v, t)));
    let best = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    return { label: this.labels[best], confidence: scores[best], ms: performance.now() - t0, scores };
  }
}

const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function normalize(a: Float32Array): Float32Array { const n = Math.sqrt(dot(a, a)); return a.map((x) => x / n); }
