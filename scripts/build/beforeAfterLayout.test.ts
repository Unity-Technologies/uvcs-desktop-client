import { describe, expect, it } from 'vitest';
import { beforeAfterLayout, beforeAfterSizeError, BEFORE_AFTER_SPACING } from './beforeAfterLayout.mts';

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
