// Cloud tier client: an OpenAI-compatible chat endpoint with image input (llm-gateway, a hosted VLM,
// or server/vlm_server.py). Sends one JPEG crop as a data URL and asks for a category from a list.
export interface CloudAnswer { raw: string; ms: number; requestBytes: number }

export type PromptMode = 'open' | 'choice';

// 'open' asks what the product is in a few words and maps the answer to a category afterwards.
// 'choice' lists every category in the prompt; small VLMs tend to repeat an option from the list.
export function buildRequest(jpegBase64: string, labels: string[], mode: PromptMode = 'open') {
  return {
    model: 'vlm',
    max_tokens: 12,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
        { type: 'text', text: mode === 'open' ? 'What kind of product is shown? Answer in two or three words.' : `What product is this? Answer with exactly one of: ${labels.join(', ')}. Answer with the category only.` },
      ],
    }],
  };
}

export async function askCloud(baseUrl: string, jpegBase64: string, labels: string[], mode: PromptMode = 'open'): Promise<CloudAnswer> {
  const body = JSON.stringify(buildRequest(jpegBase64, labels, mode));
  const t0 = performance.now();
  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  if (!r.ok) throw new Error(`cloud tier HTTP ${r.status}`);
  const j = await r.json();
  return { raw: j.choices[0].message.content, ms: performance.now() - t0, requestBytes: new TextEncoder().encode(body).length };
}
