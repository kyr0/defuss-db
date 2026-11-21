// The documents each collection of the demo store holds. The worker writes them, the page shows them; both import
// these types so a field renamed on one side fails the type check on the other.

export type Region = 'EU' | 'US' | 'APAC' | 'LATAM';
export type Status = 'Paid' | 'Pending' | 'Refunded' | 'Failed';
export const REGIONS: readonly Region[] = ['EU', 'US', 'APAC', 'LATAM'];
export const STATUSES: readonly Status[] = ['Paid', 'Pending', 'Refunded', 'Failed'];
export const PRODUCTS = [
  'Keyboard',
  'Monitor',
  'Dock',
  'Headset',
  'Webcam',
  'Laptop stand',
  'Desk lamp',
  'Cable kit',
  'Mouse',
  'Chair',
] as const;

/** A sales order. `customerKey` is the lower-cased name: DataView's `contains` is case-sensitive. */
export interface Order {
  id: string;
  customer: string;
  customerKey: string;
  region: Region;
  product: string;
  amount: number;
  date: Date;
  /** `YYYY-MM`, so a report can group by month without a date function. */
  month: string;
  status: Status;
}

/** One status change made in the grid, committed in the same transaction as the order update. */
export interface OrderEdit {
  id: string;
  orderId: string;
  from: Status;
  to: Status;
  at: Date;
}

/** A list price; the collection tracks history, so every price has effective dates. */
export interface Price {
  id: string;
  product: string;
  eur: number;
}

/** A treasury account; balances are integer cents as bigint, so sums stay exact. */
export interface Account {
  id: string;
  name: string;
  balance: bigint;
}

export interface Transfer {
  id: string;
  from: string;
  to: string;
  amount: bigint;
  at: Date;
}

/** A catalog item for full-text search. */
export interface Item {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  inStock: boolean;
}
