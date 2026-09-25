import { describe, expect, it } from 'vitest';
import { linkCurve } from './curves';
import { boundsOf, crossesView } from './linkVisibility';

const visible = { left: 100, top: 100, right: 500, bottom: 400 };

describe('linkVisibility', () => {
  it('keeps a link whose ends are both off screen but whose path crosses it', () => {
    const acrossTheScreen = boundsOf([
      { x: 0, y: 50 },
      { x: 900, y: 700 },
    ]);
    expect(crossesView(acrossTheScreen, visible)).toBe(true);
  });

  it('keeps a vertical elbow passing through the screen from a base above it', () => {
    expect(crossesView(boundsOf([{ x: 300, y: -2000 }, { x: 320, y: 250 }]), visible)).toBe(true);
  });

  it('skips a link entirely beside the screen', () => {
    expect(crossesView(boundsOf([{ x: 520, y: 0 }, { x: 900, y: 700 }]), visible)).toBe(false);
    expect(crossesView(boundsOf([{ x: 0, y: 410 }, { x: 900, y: 700 }]), visible)).toBe(false);
  });

  it('counts the margin, so line widths and arrow heads near the edge still show', () => {
    const justLeft = boundsOf([{ x: 0, y: 200 }, { x: 95, y: 200 }]);
    expect(crossesView(justLeft, visible)).toBe(false);
    expect(crossesView(justLeft, visible, 10)).toBe(true);
  });

  it('bounds a curve by its control points', () => {
    const curve = linkCurve({ x: 0, y: 0 }, { x: 64, y: 100 });
    expect(boundsOf(curve)).toEqual({ left: 0, top: 0, right: 64, bottom: 100 });
  });
});
