import { describe, expect, it } from 'vitest';
import { EMPTY_CONTENT, MAX_IMAGE_BYTES, MAX_TEXT_BYTES, toFileContent } from './fileContent';

describe('toFileContent', () => {
  it('reads text as UTF-8', () => {
    expect(toFileContent(Buffer.from('hello\n'), 'a.txt')).toEqual({ isBinary: false, size: 6, text: 'hello\n' });
  });

  it('treats a 0-byte file as empty, even with an image extension', () => {
    expect(toFileContent(Buffer.alloc(0), 'icon.png')).toBe(EMPTY_CONTENT);
  });

  it('recognizes binary content by a NUL byte', () => {
    expect(toFileContent(Buffer.from([1, 0, 2]), 'a.bin')).toEqual({ isBinary: true, size: 3 });
  });

  it('flags text over the cap as too large rather than binary', () => {
    const size = MAX_TEXT_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size, 'a'), 'big.log')).toEqual({ isBinary: true, size, tooLarge: 'text' });
  });

  it('keeps the bytes of images, recognized by extension', () => {
    const content = toFileContent(Buffer.from([137, 80, 78, 71]), 'Textures/Hero.PNG');
    expect(content.image?.mimeType).toBe('image/png');
    expect([...content.image!.bytes]).toEqual([137, 80, 78, 71]);
    expect(Buffer.isBuffer(content.image!.bytes)).toBe(false);
  });

  it('does not encode images over the cap', () => {
    const size = MAX_IMAGE_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size), 'huge.png')).toEqual({ isBinary: true, size, tooLarge: 'image' });
  });

  it('reads an SVG both as text and as an image', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    expect(toFileContent(Buffer.from(svg), 'Icons/logo.SVG')).toEqual({
      isBinary: false,
      size: svg.length,
      text: svg,
      image: { bytes: new Uint8Array(Buffer.from(svg)), mimeType: 'image/svg+xml' },
    });
  });

  it('keeps only the image of an SVG too large to diff as text, and nothing of one over the image cap', () => {
    const large = toFileContent(Buffer.alloc(MAX_TEXT_BYTES + 1, 'a'), 'map.svg');
    expect(large).toMatchObject({ isBinary: true, size: MAX_TEXT_BYTES + 1 });
    expect(large.text).toBeUndefined();
    expect(large.image?.mimeType).toBe('image/svg+xml');
    expect(large.image?.bytes.length).toBe(MAX_TEXT_BYTES + 1);
    const size = MAX_IMAGE_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size, 'a'), 'huge.svg')).toEqual({ isBinary: true, size, tooLarge: 'image' });
  });
});
