import { describe, expect, it } from 'vitest';
import { decodedSize, MAX_VECTOR_PIXELS } from './decodedSize';

describe('decodedSize', () => {
  it('keeps the size an image declares', () => {
    expect(decodedSize({ width: 640, height: 480 }, true)).toEqual({ width: 640, height: 480 });
    expect(decodedSize({ width: 20000, height: 20000 }, false)).toEqual({ width: 20000, height: 20000 });
  });

  it('gives an SVG with no size a default canvas', () => {
    expect(decodedSize({ width: 0, height: 0 }, true)).toEqual({ width: 300, height: 150 });
  });

  it('draws a vector declaring a huge size smaller, in proportion', () => {
    const size = decodedSize({ width: 100000, height: 50000 }, true);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_VECTOR_PIXELS + size.width + size.height);
    expect(size.width / size.height).toBeCloseTo(2, 2);
  });
});
