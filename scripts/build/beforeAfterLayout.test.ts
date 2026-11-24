import { describe, expect, it } from 'vitest';
import { BEFORE_AFTER_SPACING, BEFORE_AFTER_USAGE, beforeAfterArguments, beforeAfterLayout, beforeAfterSizeError, cropBoxError } from './beforeAfterLayout.mts';

const { padding, gap, labelHeight } = BEFORE_AFTER_SPACING;

describe('beforeAfterLayout', () => {
  it('puts a narrow or square shot side by side, each under its label: it keeps the picture wider than tall', () => {
    const layout = beforeAfterLayout({ width: 300, height: 200 });
    expect(layout.direction).toBe('row');
    expect(layout.width).toBe(padding * 2 + 300 * 2 + gap);
    expect(layout.height).toBe(padding * 2 + labelHeight + 200);
    expect(layout.panels).toEqual([
      { label: 'Before', x: padding, y: padding + labelHeight, width: 300, height: 200 },
      { label: 'After', x: padding + 300 + gap, y: padding + labelHeight, width: 300, height: 200 },
    ]);
  });

  it('stacks a wide strip, which side by side would shrink to a sliver in the note', () => {
    const layout = beforeAfterLayout({ width: 600, height: 90 });
    expect(layout.direction).toBe('column');
    expect(layout.width).toBe(padding * 2 + 600);
    expect(layout.height).toBe(padding * 2 + (labelHeight + 90) * 2 + gap);
    expect(layout.panels[1]).toEqual({ label: 'After', x: padding, y: padding + labelHeight + 90 + gap + labelHeight, width: 600, height: 90 });
  });

  it('draws the labels and the spacing larger for a shot taken at twice the pixels', () => {
    const layout = beforeAfterLayout({ width: 600, height: 400 }, 2);
    expect(layout.labelHeight).toBe(labelHeight * 2);
    expect(layout.panels[0]).toEqual({ label: 'Before', x: padding * 2, y: (padding + labelHeight) * 2, width: 600, height: 400 });
  });
});

describe('beforeAfterSizeError', () => {
  it('accepts two shots of the same size: the same crop of the same place', () => {
    expect(beforeAfterSizeError({ width: 300, height: 200 }, { width: 300, height: 200 })).toBeNull();
  });

  it('refuses two shots of different sizes, where more than the change would differ', () => {
    expect(beforeAfterSizeError({ width: 300, height: 200 }, { width: 310, height: 200 })).toBe(
      'The before shot is 300×200 and the after shot 310×200: crop both from the same area, at the same window size.',
    );
  });
});

describe('cropBoxError', () => {
  it('accepts a box inside the shot', () => {
    expect(cropBoxError({ x: 10, y: 20, width: 300, height: 100 }, { width: 1300, height: 850 })).toBeNull();
  });

  it('refuses a box that reaches past the shot, which would crop less than asked', () => {
    expect(cropBoxError({ x: 1200, y: 20, width: 300, height: 100 }, { width: 1300, height: 850 })).toBe(
      'The crop 1200,20,300,100 reaches past the 1300×850 shot.',
    );
  });
});

describe('beforeAfterArguments', () => {
  it('reads the three files and the options after the script', () => {
    expect(beforeAfterArguments(['--scale=2', '--crop=10,20,300,100', '--dark', 'b.png', 'a.png', 'out.png'])).toEqual({
      before: 'b.png',
      after: 'a.png',
      output: 'out.png',
      pixelRatio: 2,
      crop: { x: 10, y: 20, width: 300, height: 100 },
      dark: true,
    });
  });

  it('takes the shots whole, at one pixel per point, in the light frame, by default', () => {
    expect(beforeAfterArguments(['b.png', 'a.png', 'out.png'])).toEqual({ before: 'b.png', after: 'a.png', output: 'out.png', pixelRatio: 1, crop: null, dark: false });
  });

  it('refuses anything but three files', () => {
    expect(beforeAfterArguments(['b.png', 'a.png'])).toBe(BEFORE_AFTER_USAGE);
  });

  it('refuses a scale that is not a positive number, and a crop that is not four of them', () => {
    expect(beforeAfterArguments(['--scale=abc', 'b.png', 'a.png', 'out.png'])).toBe(BEFORE_AFTER_USAGE);
    expect(beforeAfterArguments(['--crop=10,20,300', 'b.png', 'a.png', 'out.png'])).toBe(BEFORE_AFTER_USAGE);
    expect(beforeAfterArguments(['--crop=10,20,0,100', 'b.png', 'a.png', 'out.png'])).toBe(BEFORE_AFTER_USAGE);
  });

  it('refuses an option it does not know', () => {
    expect(beforeAfterArguments(['--hires', 'b.png', 'a.png', 'out.png'])).toBe(BEFORE_AFTER_USAGE);
  });
});
