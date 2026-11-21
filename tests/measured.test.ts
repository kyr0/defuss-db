import { expect, it } from 'vitest';
import { measuredQueue, sourceMeasure } from '../src/measured.js';

const counted = () => {
  const calls: object[] = [];
  return { calls, measure: (row: { n: number }) => (calls.push(row), row.n * 10) };
};

it('answers the second measurement of a source row without measuring it again', () => {
  const { calls, measure } = counted();
  const sizeOf = measuredQueue(measure);
  const rows = [{ n: 1 }, { n: 2 }, { n: 3 }];
  const queued = sourceMeasure(sizeOf);
  expect(rows.map(queued)).toEqual([10, 20, 30]);
  expect(rows.map(sizeOf)).toEqual([10, 20, 30]);
  expect(calls).toEqual(rows);
});

it('measures rows the source did not queue, or asked out of order, directly', () => {
  const { calls, measure } = counted();
  const sizeOf = measuredQueue(measure);
  const [a, b, other] = [{ n: 1 }, { n: 2 }, { n: 7 }];
  sourceMeasure(sizeOf)(a);
  sourceMeasure(sizeOf)(b);
  expect(sizeOf(other)).toBe(70);
  expect(sizeOf(b)).toBe(20);
  expect(sizeOf(a)).toBe(10);
  expect(calls).toEqual([a, b, other, b]);
});

it('leaves a plain sizeOf unchanged for sources outside the queue', () => {
  const plain = (row: { n: number }) => row.n;
  expect(sourceMeasure(plain)).toBe(plain);
});
