import { describe, expect, it } from 'vitest';
import { evaluate, route, Item } from '../src/router/router';
import { matchLabel } from '../src/router/labels';
import { softmax } from '../src/router/softmax';

const it2 = (label: string, inCatalog: boolean, edgePred: string, edgeConf: number, cloudPred: string | null): Item =>
  ({ label, inCatalog, edgePred, edgeConf, edgeMs: 10, cloudPred, cloudMs: 1000, cloudBytes: 2048 });

describe('router', () => {
  it('routes by threshold', () => {
    expect(route(0.9, 0.8)).toBe('edge');
    expect(route(0.5, 0.8)).toBe('cloud');
  });
  it('threshold 0 never escalates, threshold above 1 always does', () => {
    const items = [it2('a', true, 'a', 0.9, 'a'), it2('b', false, 'a', 0.4, 'b')];
    expect(evaluate(items, 0)).toMatchObject({ escalated: 0, accuracy: 0.5, kbPerQuery: 0 });
    expect(evaluate(items, 1.01)).toMatchObject({ escalated: 1, accuracy: 1, kbPerQuery: 2 });
  });
  it('escalating the unsure out-of-catalog item fixes it', () => {
    const items = [it2('a', true, 'a', 0.9, 'a'), it2('b', false, 'a', 0.4, 'b')];
    const p = evaluate(items, 0.5);
    expect(p.accuracy).toBe(1);
    expect(p.escalatedOut).toBe(1);
  });
});

describe('label matching', () => {
  const labels = ['Tshirts', 'Casual Shoes', 'Flip Flops', 'Shoes'];
  it('handles case, punctuation, plurals and extra words', () => {
    expect(matchLabel('Tshirts.', labels)).toBe('Tshirts');
    expect(matchLabel('casual shoe', labels)).toBe('Casual Shoes');
    expect(matchLabel('These are flip flops', labels)).toBe('Flip Flops');
    expect(matchLabel('a banana', labels)).toBeNull();
  });
  it('maps open answers through aliases, longest first', () => {
    const all = ['Tshirts', 'Track Pants', 'Trousers', 'Sports Shoes', 'Casual Shoes', 'Watches', 'Backpacks'];
    expect(matchLabel('T-shirt.', all)).toBe('Tshirts');
    expect(matchLabel('Black track pants', all)).toBe('Track Pants');
    expect(matchLabel('Running shoes', all)).toBe('Sports Shoes');
    expect(matchLabel('Watch.', all)).toBe('Watches');
    expect(matchLabel('Shoes.', all)).toBeNull(); // ambiguous: no guess
  });
});

describe('softmax', () => {
  it('sums to one and keeps order', () => {
    const s = softmax([1, 2, 3]);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s[2]).toBeGreaterThan(s[1]);
  });
});
