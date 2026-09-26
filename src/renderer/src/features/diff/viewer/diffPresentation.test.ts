import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { diffPresentation, hasTwoRepresentations } from './diffPresentation';

const missing: FileContent = { text: '', isBinary: false, size: 0 };
const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });
const svg = (value: string): FileContent => ({ ...text(value), imageDataUrl: `data:image/svg+xml;base64,${btoa(value)}` });
const image = (size: number): FileContent => ({ isBinary: true, size, imageDataUrl: 'data:image/png;base64,AA==' });

describe('diffPresentation', () => {
  it('shows an added 0-byte file as empty, not as identical', () => {
    expect(diffPresentation(missing, text(''))).toEqual({ kind: 'text', empty: true, identical: true });
  });

  it('compares text, noting when both versions are identical', () => {
    expect(diffPresentation(text('a'), text('b'))).toEqual({ kind: 'text', empty: false, identical: false });
    expect(diffPresentation(text('a'), text('a'))).toEqual({ kind: 'text', empty: false, identical: true });
  });

  it('reports a file too large on either side, whatever the other side is', () => {
    expect(diffPresentation(text('a'), { isBinary: true, size: 11e6, tooLarge: 'text' })).toEqual({ kind: 'tooLarge', content: 'text' });
    expect(diffPresentation({ isBinary: true, size: 50e6, tooLarge: 'image' }, image(10))).toEqual({ kind: 'tooLarge', content: 'image' });
  });

  it('compares images, or previews the one side of an added or deleted image', () => {
    expect(diffPresentation(image(10), image(12))).toEqual({ kind: 'image', comparable: true });
    expect(diffPresentation(missing, image(12))).toEqual({ kind: 'image', comparable: false });
  });

  it('falls back to a binary summary', () => {
    expect(diffPresentation({ isBinary: true, size: 3 }, { isBinary: true, size: 4 })).toEqual({ kind: 'binary' });
  });

  it('shows an SVG as text or rendered, as asked', () => {
    expect(hasTwoRepresentations(svg('<svg/>'), svg('<svg></svg>'))).toBe(true);
    expect(diffPresentation(svg('<svg/>'), svg('<svg></svg>'))).toEqual({ kind: 'text', empty: false, identical: false });
    expect(diffPresentation(svg('<svg/>'), svg('<svg></svg>'), 'image')).toEqual({ kind: 'image', comparable: true });
  });

  it('previews an added or deleted SVG in the image representation', () => {
    expect(hasTwoRepresentations(missing, svg('<svg/>'))).toBe(true);
    expect(diffPresentation(missing, svg('<svg/>'), 'image')).toEqual({ kind: 'image', comparable: false });
    expect(diffPresentation(svg('<svg/>'), missing, 'text')).toEqual({ kind: 'text', empty: false, identical: false });
  });

  it('offers no choice when a side is only text or only an image', () => {
    expect(hasTwoRepresentations(text('<svg/>'), svg('<svg/>'))).toBe(false);
    expect(hasTwoRepresentations(image(10), svg('<svg/>'))).toBe(false);
    expect(diffPresentation(text('a'), text('b'), 'image')).toEqual({ kind: 'text', empty: false, identical: false });
    expect(diffPresentation(image(10), svg('<svg/>'), 'text')).toEqual({ kind: 'image', comparable: true });
  });
});
