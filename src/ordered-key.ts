import { DatabaseError } from './errors.js';
import type { IndexDirection } from './types.js';

const hex = '0123456789abcdef';
const inverted = 'fedcba9876543210';
const words = new DataView(new ArrayBuffer(8));
const maxMagnitude = 1n << 16384n;
const flip = (value: string): string =>
  value.replace(/[0-9a-f]/g, (c) => inverted[hex.indexOf(c)]!);

// Normalize signed zero. Negative IEEE bits reverse magnitude order, positive bits need only a sign flip.
// Both halves are emitted in big-endian order. No 64-bit arithmetic is needed on the Number hot path.
function numeric(value: number): string {
  words.setFloat64(0, value === 0 ? 0 : value, false);
  const hi = words.getUint32(0, false),
    lo = words.getUint32(4, false);
  return (
    ((value < 0 ? ~hi : hi ^ 0x80000000) >>> 0).toString(16).padStart(8, '0') +
    ((value < 0 ? ~lo : lo) >>> 0).toString(16).padStart(8, '0')
  );
}

/** Hex payload in the portable DataView sort order. Equal sort keys intentionally encode identically. */
export function orderBody(value: unknown): string {
  if (value == null) return '8';
  if (typeof value === 'boolean') return value ? '01' : '00';
  if (typeof value === 'number') return Number.isNaN(value) ? '7' : '1' + numeric(value);
  if (typeof value === 'bigint') {
    if (value >= maxMagnitude || value <= -maxMagnitude)
      throw new RangeError('BigInt exceeds index-key capacity.');
    const magnitude = (value < 0n ? -value : value).toString(16);
    const sized = magnitude.length.toString(16).padStart(4, '0') + magnitude;
    return value < 0n ? '20' + flip(sized) : '21' + sized;
  }
  if (typeof value === 'string') {
    if (value.length > 1024) throw new RangeError('String exceeds index-key capacity.');
    let result = '3';
    for (let i = 0; i < value.length; i++)
      result += value.charCodeAt(i).toString(16).padStart(4, '0');
    return result;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? '7' : '4' + numeric(time);
  }
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : undefined;
  if (bytes) {
    if (bytes.length > 2048) throw new RangeError('Binary exceeds index-key capacity.');
    let result = '5';
    for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
    return result;
  }
  throw new DatabaseError(
    'INVALID_INDEX_VALUE',
    'Ordered indexes accept scalar, Date and binary values.',
  );
}

/** The terminator sorts below every ascending digit, above every descending digit. This also reverses prefix strings. */
export function orderComponent(body: string, direction: IndexDirection): string {
  return direction === 'asc' ? body + '!' : flip(body) + '~';
}
