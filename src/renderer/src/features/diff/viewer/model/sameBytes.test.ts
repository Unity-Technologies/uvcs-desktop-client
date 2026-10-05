import { describe, expect, it } from 'vitest';
import { sameBytes } from './sameBytes';

describe('sameBytes', () => {
  it('tells two reads of the same file apart from a changed one, to the last byte', () => {
    expect(sameBytes(new Uint8Array([1, 2, 3, 4, 5]), new Uint8Array([1, 2, 3, 4, 5]))).toBe(true);
    expect(sameBytes(new Uint8Array([1, 2, 3, 4, 5]), new Uint8Array([1, 2, 3, 4, 6]))).toBe(false);
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('compares views that start anywhere in their buffers', () => {
    const buffer = new Uint8Array([9, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sameBytes(buffer.subarray(1), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(true);
  });
});
