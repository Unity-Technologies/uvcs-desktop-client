import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltipPlacement';

const viewport = { width: 1000, height: 800 };
const bubble = { width: 200, height: 40 };

describe('placeTooltip', () => {
  it('opens below the cursor, its caret on it', () => {
    expect(placeTooltip({ x: 300, y: 200 }, bubble, viewport)).toEqual({ top: 218, left: 282, side: 'below', arrowX: 18 });
  });

  it('flips above near the bottom edge', () => {
    expect(placeTooltip({ x: 300, y: 780 }, bubble, viewport)).toMatchObject({ top: 722, side: 'above' });
  });

  it('opens above when the element asks, keeping off what lies under the cursor', () => {
    expect(placeTooltip({ x: 300, y: 200 }, bubble, viewport, 'above')).toMatchObject({ top: 142, side: 'above' });
  });

  it('flips below near the top edge when it asked for above', () => {
    expect(placeTooltip({ x: 300, y: 30 }, bubble, viewport, 'above')).toMatchObject({ top: 48, side: 'below' });
  });

  it('shifts to stay on screen while its caret keeps pointing at the cursor', () => {
    expect(placeTooltip({ x: 990, y: 200 }, bubble, viewport)).toMatchObject({ left: 792, arrowX: 186 });
    expect(placeTooltip({ x: 4, y: 200 }, bubble, viewport)).toMatchObject({ left: 8, arrowX: 14 });
  });
});
