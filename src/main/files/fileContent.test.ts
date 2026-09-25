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

  it('encodes images as data URLs, recognized by extension', () => {
    const content = toFileContent(Buffer.from([137, 80, 78, 71]), 'Textures/Hero.PNG');
    expect(content.imageDataUrl).toBe('data:image/png;base64,iVBORw==');
  });

  it('does not encode images over the cap', () => {
    const size = MAX_IMAGE_BYTES + 1;
    expect(toFileContent(Buffer.alloc(size), 'huge.png')).toEqual({ isBinary: true, size, tooLarge: 'image' });
  });
});
