/// <reference types="node" />
import { resolveObjectURL } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { imageUrl } from './useImageUrl';

describe('imageUrl', () => {
  it("serves the image's own bytes, of its type, until revoked", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const url = imageUrl({ bytes, mimeType: 'image/png' });
    expect(url).toMatch(/^blob:/);
    const blob = resolveObjectURL(url)!;
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([...bytes]);
    URL.revokeObjectURL(url);
    expect(resolveObjectURL(url)).toBeUndefined();
  });

  it('gives every image its own URL', () => {
    const image = { bytes: new Uint8Array([1]), mimeType: 'image/svg+xml' };
    const [first, second] = [imageUrl(image), imageUrl(image)];
    expect(first).not.toBe(second);
    URL.revokeObjectURL(first);
    URL.revokeObjectURL(second);
  });
});
