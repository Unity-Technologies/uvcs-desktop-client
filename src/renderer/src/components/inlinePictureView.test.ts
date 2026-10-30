import { describe, expect, it } from 'vitest';
import { inlinePictureView, pictureLoadAfter } from './inlinePictureView';

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
