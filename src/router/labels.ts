// Map a model's free-text answer onto a known category. Common shop words for each category are
// listed as aliases, written once from general retail vocabulary (not tuned on the eval answers).
// Returns null when nothing matches, which the evaluation counts as wrong.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const stem = (s: string) => norm(s).split(' ').map((w) => (/(ch|sh|ss|x)es$/.test(w) ? w.slice(0, -2) : w.replace(/s$/, ''))).join(' ');

export const ALIASES: Record<string, string[]> = {
  Tshirts: ['t shirt', 'tshirt', 'tee', 't shirts'], Shirts: ['shirt', 'button up', 'button down'], Tops: ['top', 'blouse', 'tank top', 'crop top'],
  Kurtas: ['kurta', 'tunic'], Sarees: ['saree', 'sari'], Dresses: ['dress', 'gown'], Jeans: ['jeans', 'denim'],
  Trousers: ['trouser', 'pants', 'chinos', 'slacks'], 'Track Pants': ['track pant', 'joggers', 'sweatpants', 'track pants'], Shorts: ['shorts'],
  Briefs: ['brief', 'underwear', 'boxers', 'trunks'], Bra: ['bra', 'brassiere'], Socks: ['sock'],
  'Casual Shoes': ['casual shoe', 'sneaker', 'canvas shoe'], 'Sports Shoes': ['sports shoe', 'running shoe', 'trainer', 'athletic shoe'],
  'Formal Shoes': ['formal shoe', 'oxford', 'derby', 'loafer', 'dress shoe', 'leather shoe'], Heels: ['heel', 'high heel', 'pump', 'stiletto'],
  Flats: ['flat', 'ballet flat'], Sandals: ['sandal'], 'Flip Flops': ['flip flop', 'slipper'],
  Watches: ['watch', 'wristwatch'], Sunglasses: ['sunglasses', 'shades'], Belts: ['belt'], Wallets: ['wallet'],
  Handbags: ['handbag', 'bag', 'purse', 'tote'], Backpacks: ['backpack', 'rucksack'], Clutches: ['clutch'],
  Earrings: ['earring'], 'Perfume and Body Mist': ['perfume', 'fragrance', 'body mist', 'cologne'], Deodorant: ['deodorant', 'antiperspirant'],
};

export function matchLabel(answer: string, labels: string[]): string | null {
  const a = norm(answer.split('\n')[0]);
  for (const l of labels) if (norm(l) === a || stem(l) === stem(a)) return l;
  // longest alias first, so "sports shoe" wins over "shoe", "track pants" over "pants"
  const cands = labels.flatMap((l) => [l, ...(ALIASES[l] ?? [])].map((w) => ({ l, w: stem(w) }))).sort((x, y) => y.w.length - x.w.length);
  const sa = ` ${stem(a)} `;
  for (const c of cands) if (sa.includes(` ${c.w} `)) return c.l;
  return null;
}
