import { describe, expect, it } from 'vitest';
import { changedLabel, colorHex, sideLabel, undecodedDescription, undecodedTip, unpaintedNotice } from './imageInfo';

describe('sideLabel', () => {
  it('shows dimensions and size', () => {
    expect(sideLabel({ width: 64, height: 32 }, 178)).toBe('64×32 · 178 B');
  });
});

describe('undecodedDescription', () => {
  it("gives the sizes as a binary diff does, then why the image can't show", () => {
    expect(undecodedDescription({ size: 1024 }, { size: 2048 }, 'psdWithoutComposite')).toBe("1.0 KB → 2.0 KB. Can't read this PSD: save it with Maximize Compatibility.");
    expect(undecodedDescription({ size: 0 }, { size: 178 }, 'tooLarge')).toBe('0 B → 178 B. Too large to show.');
  });
});

describe('unpaintedNotice', () => {
  it('names the version that does not show, and why', () => {
    expect(unpaintedNotice('new', 'psdWithoutComposite')).toBe("The version after is left out. Can't read this PSD: save it with Maximize Compatibility.");
    expect(unpaintedNotice('old', 'tooLarge')).toBe('The version before is left out. Too large to show.');
  });
});

describe('undecodedTip', () => {
  it('says why a preview shows no image, and a damaged file in general words', () => {
    expect(undecodedTip('psdColorMode')).toBe("Can't read this PSD: save it as 8 or 16-bit RGB");
    expect(undecodedTip('unreadable')).toBe("Couldn't display this image");
    expect(undecodedTip(undefined)).toBe("Couldn't display this image");
  });
});

describe('changedLabel', () => {
  it('reports the share of covered pixels that differ', () => {
    expect(changedLabel({ changedPixels: 484, coveredPixels: 1000 }, 0)).toBe('48.4% of pixels differ');
    expect(changedLabel({ changedPixels: 1, coveredPixels: 10_000 }, 0)).toBe('< 0.1% of pixels differ');
  });

  it('only calls a pair pixel-identical without a tolerance', () => {
    expect(changedLabel({ changedPixels: 0, coveredPixels: 1000 }, 0)).toBe('pixel-identical');
    expect(changedLabel({ changedPixels: 0, coveredPixels: 1000 }, 8)).toBe('no changes above tolerance');
  });

  it('has nothing to say before any pixel is covered', () => {
    expect(changedLabel({ changedPixels: 0, coveredPixels: 0 }, 0)).toBeNull();
  });
});

describe('colorHex', () => {
  it('writes an opaque color as #RRGGBB', () => {
    expect(colorHex([255, 8, 170, 255])).toBe('#ff08aa');
  });

  it('adds the alpha when the color is see-through', () => {
    expect(colorHex([0, 0, 0, 128])).toBe('#000000/80');
  });
});
