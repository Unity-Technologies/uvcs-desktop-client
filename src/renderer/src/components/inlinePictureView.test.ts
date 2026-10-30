import { describe, expect, it } from 'vitest';
import { inlinePictureView, pictureEnlarges, pictureLoadAfter } from './inlinePictureView';

describe('a picture shown in the text', () => {
  it('holds its place quietly while it loads, then shows itself', () => {
    expect(inlinePictureView('loading')).toBe('placeholder');
    expect(inlinePictureView('loaded')).toBe('picture');
  });

  it('falls back to the chip when it fails, keeping its description and link', () => {
    expect(inlinePictureView('failed')).toBe('chip');
  });

  it('has loaded only when the browser read a picture of some size', () => {
    expect(pictureLoadAfter('load', 1280)).toBe('loaded');
    expect(pictureLoadAfter('load', 0)).toBe('failed');
    expect(pictureLoadAfter('error', 0)).toBe('failed');
  });
});

describe('clicking a picture shown in the text', () => {
  it('enlarges it when the text shows it smaller than it is', () => {
    expect(pictureEnlarges(1280, 586)).toBe(true);
  });

  it('does nothing when it already shows at its own size, a pixel of rounding aside', () => {
    expect(pictureEnlarges(420, 420)).toBe(false);
    expect(pictureEnlarges(420.4, 420)).toBe(false);
  });
});
