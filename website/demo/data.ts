// Seeded generators for the demo store. Pure functions: the same seed gives the same documents, so every visitor's
// first visit writes the same data and the e2e test can name an order it expects.
// Orders are generated in date order with zero-padded string IDs. VERIFIED: (Chromium probe, 2026-11-20, 100,000
// orders): numeric IDs are stored as lexicographic tokens ("10" before "9"), so ascending numbers scatter their
// inserts across the key space; padded string IDs append to its end.
import type { Account, Item, Order, Region, Status } from './shared/records.js';
import { PRODUCTS, REGIONS } from './shared/records.js';

/** mulberry32: a small seedable PRNG; Math.random() cannot be seeded. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(next: () => number, list: readonly T[]): T =>
  list[Math.floor(next() * list.length)] as T;

const FIRST = [
  'Ada',
  'Alan',
  'Barbara',
  'Claude',
  'Dennis',
  'Edsger',
  'Frances',
  'Grace',
  'Hedy',
  'Ivan',
  'Jean',
  'Ken',
  'Linus',
  'Margaret',
  'Niklaus',
  'Radia',
  'Sophie',
  'Tim',
  'Ursula',
  'Vint',
];
const LAST = [
  'Lovelace',
  'Turing',
  'Liskov',
  'Shannon',
  'Ritchie',
  'Dijkstra',
  'Allen',
  'Hopper',
  'Lamarr',
  'Sutherland',
  'Sammet',
  'Thompson',
  'Torvalds',
  'Hamilton',
  'Wirth',
  'Perlman',
  'Wilson',
  'Berners-Lee',
  'Franklin',
  'Cerf',
];
const STATUS_MIX: readonly Status[] = ['Paid', 'Paid', 'Paid', 'Pending', 'Refunded', 'Failed'];
const DAY = 86_400_000;
const START = Date.UTC(2025, 0, 1, 8);
const SPAN = 640 * DAY;

export const ORDER_COUNT = 100_000;
export const orderId = (n: number) => 'SO-' + String(n).padStart(6, '0');

/** All orders in batches of `size`, oldest first: id SO-000001 is the first order of 2025. */
export function* orderBatches(total = ORDER_COUNT, size = 4_000, seed = 1): Generator<Order[]> {
  const next = random(seed);
  for (let from = 0; from < total; from += size) {
    const batch: Order[] = [];
    for (let n = from; n < Math.min(total, from + size); n++) {
      const customer = `${pick(next, FIRST)} ${pick(next, LAST)}`;
      const date = new Date(START + Math.floor((n / total) * SPAN + next() * 3_600_000));
      batch.push({
        id: orderId(n + 1),
        customer,
        customerKey: customer.toLowerCase(),
        region: pick<Region>(next, REGIONS),
        product: pick(next, PRODUCTS),
        amount: Math.round(Math.exp(2 + next() * 6.5) * 100) / 100,
        date,
        month: date.toISOString().slice(0, 7),
        status: pick(next, STATUS_MIX),
      });
    }
    yield batch;
  }
}

/** The price list: three effective steps per SKU, each written as one historic transaction. */
export const PRICE_STEPS = ['2025-01-01', '2025-07-01', '2026-01-01'] as const;
export const PRICE_LIST: readonly {
  id: string;
  product: string;
  eur: readonly [number, number, number];
}[] = [
  { id: 'KB-100', product: 'Keyboard', eur: [89, 94, 99] },
  { id: 'MN-270', product: 'Monitor', eur: [329, 349, 339] },
  { id: 'DK-410', product: 'Dock', eur: [189, 199, 209] },
  { id: 'HS-300', product: 'Headset', eur: [129, 135, 139] },
  { id: 'WC-120', product: 'Webcam', eur: [79, 84, 84] },
  { id: 'LS-050', product: 'Laptop stand', eur: [49, 52, 55] },
  { id: 'DL-060', product: 'Desk lamp', eur: [59, 62, 64] },
  { id: 'CK-010', product: 'Cable kit', eur: [24, 25, 27] },
  { id: 'MS-200', product: 'Mouse', eur: [39, 42, 44] },
  { id: 'CH-900', product: 'Chair', eur: [449, 469, 489] },
];
/** Recorded after all three steps: two mid-year prices were keyed wrong and apply until the 2026 list. */
export const PRICE_CORRECTION = {
  from: '2025-07-01',
  until: '2026-01-01',
  eur: { 'MN-270': 339, 'DK-410': 194 } as Record<string, number>,
};

/** Treasury accounts holding 1,000,000.00 EUR in total, as integer cents. */
export const ACCOUNTS: readonly Account[] = [
  { id: 'OPS', name: 'Operating', balance: 42_000_000n },
  { id: 'PAY', name: 'Payroll', balance: 18_000_000n },
  { id: 'TAX', name: 'Tax reserve', balance: 9_500_000n },
  { id: 'SAV', name: 'Savings', balance: 25_000_000n },
  { id: 'RCV', name: 'Receivables clearing', balance: 4_000_000n },
  { id: 'FX', name: 'Foreign exchange', balance: 1_500_000n },
];

const BRANDS = [
  'Nordwerk',
  'Lumio',
  'Kestrel',
  'Arbor',
  'Vantage',
  'Pixelhaus',
  'Fjord',
  'Quill',
  'Orbit',
  'Tessera',
  'Halden',
  'Marlow',
];
const SERIES = [
  'Atlas',
  'Nova',
  'Pilot',
  'Forma',
  'Strata',
  'Echo',
  'Summit',
  'Vector',
  'Prism',
  'Delta',
  'Aero',
  'Core',
];
/** Kinds, traits and features per category, so generated names read like real listings. */
/** eur: the category's price range; prices are log-uniform within it. */
const CATEGORIES: Record<
  string,
  { kinds: string[]; traits: string[]; features: string[]; eur: [number, number] }
> = {
  Peripherals: {
    kinds: ['keyboard', 'mouse', 'trackball', 'numpad', 'drawing tablet'],
    traits: ['wireless', 'mechanical', 'low-profile', 'ergonomic', 'silent', 'backlit', 'compact'],
    features: [
      'quiet switches',
      'multi-device pairing',
      'USB-C charging',
      'per-key lighting',
      'a two-year battery life',
      'a detachable cable',
    ],
    eur: [19, 249],
  },
  Displays: {
    kinds: ['monitor', 'portable monitor', 'monitor arm', 'privacy filter'],
    traits: ['4K', 'ultrawide', 'matte', 'height-adjustable', 'curved', 'USB-C'],
    features: [
      'a 144 Hz refresh rate',
      'a matte finish',
      'height adjustment',
      'a built-in KVM switch',
      'power delivery up to 90 W',
      'a gas spring arm',
    ],
    eur: [39, 1199],
  },
  Audio: {
    kinds: ['headset', 'speakerphone', 'earbuds', 'microphone'],
    traits: ['noise-cancelling', 'wireless', 'Bluetooth', 'open-back', 'compact'],
    features: [
      'an adjustable boom microphone',
      'a carrying pouch',
      'multi-device pairing',
      'a two-year battery life',
      'echo cancellation',
      'a mute button',
    ],
    eur: [29, 399],
  },
  Connectivity: {
    kinds: ['USB-C dock', 'USB hub', 'HDMI adapter', 'KVM switch', 'charging cable'],
    traits: ['Thunderbolt', 'compact', 'aluminium', 'braided', 'travel'],
    features: [
      'Ethernet and two display outputs',
      'power delivery up to 100 W',
      'a braided cable',
      'an SD card reader',
      'Linux, macOS and Windows support',
      'four USB-A ports',
    ],
    eur: [9, 349],
  },
  Furniture: {
    kinds: ['office chair', 'standing desk', 'footrest', 'laptop stand'],
    traits: ['ergonomic', 'foldable', 'recycled', 'aluminium', 'electric'],
    features: [
      'a lumbar support',
      'a memory-foam cushion',
      'height adjustment',
      'cable management',
      'a ten-year warranty',
      'a matte finish',
    ],
    eur: [39, 899],
  },
  Lighting: {
    kinds: ['desk lamp', 'monitor light bar', 'ring light'],
    traits: ['dimmable', 'LED', 'clamp-on', 'wireless'],
    features: [
      'warm and cold white light',
      'a touch dimmer',
      'USB-C power',
      'an aluminium base',
      'an auto-dimming sensor',
      'a memory function',
    ],
    eur: [19, 199],
  },
};
export const CATEGORY_NAMES = Object.keys(CATEGORIES);

/** Catalog items for full-text search: id, name, brand, category, description, price, stock. */
export function* catalogBatches(total = 5_000, size = 1_000, seed = 5): Generator<Item[]> {
  const next = random(seed);
  for (let from = 0; from < total; from += size) {
    const batch: Item[] = [];
    for (let n = from; n < Math.min(total, from + size); n++) {
      const category = pick(next, CATEGORY_NAMES);
      const { kinds, traits, features, eur } = CATEGORIES[category]!;
      const kind = pick(next, kinds);
      const trait = pick(next, traits);
      const brand = pick(next, BRANDS);
      const first = pick(next, features);
      const second =
        features[(features.indexOf(first) + 1 + Math.floor(next() * 4)) % features.length] ?? first;
      batch.push({
        id: 'SKU-' + String(n + 1).padStart(5, '0'),
        name: `${brand} ${pick(next, SERIES)} ${trait} ${kind}`,
        brand,
        category,
        description: `A ${trait} ${kind} with ${first} and ${second}.`,
        price: Math.round(eur[0] * (eur[1] / eur[0]) ** next()) - 0.01,
        inStock: next() > 0.2,
      });
    }
    yield batch;
  }
}
