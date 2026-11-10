export function softmax(x: number[]): number[] {
  const m = Math.max(...x);
  const e = x.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
