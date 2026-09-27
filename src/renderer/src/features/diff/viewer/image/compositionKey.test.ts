import { describe, expect, it } from 'vitest';
import { compositionKey } from './compositionKey';
import type { DecodedImage } from './useDecodedImage';

const decoded = (src: string): DecodedImage => ({ src, el: {} as HTMLImageElement, width: 4_000, height: 4_000 });

describe('compositionKey', () => {
  it('names a pair by its decoded images and anchor, however big their data URLs', () => {
    const [before, after] = [decoded(`data:image/png;base64,${'A'.repeat(1_000_000)}`), decoded('data:image/png;base64,B')];
    const key = compositionKey(before, after, 'center');
    expect(compositionKey(before, after, 'center')).toBe(key);
    expect(key.length).toBeLessThan(40);
    expect(compositionKey(before, after, 'top-left')).not.toBe(key);
    expect(compositionKey(after, before, 'center')).not.toBe(key);
  });

  it('tells apart images decoded anew, even from the same data URL', () => {
    const [before, after] = [decoded('data:a'), decoded('data:b')];
    expect(compositionKey(decoded('data:a'), after, 'center')).not.toBe(compositionKey(before, after, 'center'));
  });
});
