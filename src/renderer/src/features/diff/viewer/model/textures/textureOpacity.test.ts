import { describe, expect, it } from 'vitest';
import { everyPixelOpaque } from './textureOpacity';

describe('everyPixelOpaque', () => {
  it('is opaque only when every pixel has full alpha', () => {
    expect(everyPixelOpaque(new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 255]))).toBe(true);
    expect(everyPixelOpaque(new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 254]))).toBe(false);
    expect(everyPixelOpaque(new Uint8ClampedArray([255, 255, 255, 0]))).toBe(false);
  });
});
