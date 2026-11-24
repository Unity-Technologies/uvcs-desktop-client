import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltipPlacement';

const viewport = { width: 1000, height: 800 };
const bubble = { width: 200, height: 40 };

describe('placeTooltip', () => {
  describe('by the cursor', () => {
    it('opens below it, its caret on it', () => {
      expect(placeTooltip({ pointer: { x: 300, y: 200 } }, bubble, viewport)).toEqual({ top: 218, left: 282, side: 'below', arrowX: 18 });
    });

    it('flips above near the bottom edge', () => {
      expect(placeTooltip({ pointer: { x: 300, y: 780 } }, bubble, viewport)).toMatchObject({ top: 722, side: 'above' });
    });

    it('shifts to stay on screen while its caret keeps pointing at the cursor', () => {
      expect(placeTooltip({ pointer: { x: 990, y: 200 } }, bubble, viewport)).toMatchObject({ left: 792, arrowX: 186 });
      expect(placeTooltip({ pointer: { x: 4, y: 200 } }, bubble, viewport)).toMatchObject({ left: 8, arrowX: 14 });
    });
  });

  describe('on an element that asks for above (a comment pin, over what it is about)', () => {
    const pin = { left: 390, top: 300, width: 20, height: 24 };

    it('sits above it, its caret on its middle wherever the cursor is on it', () => {
      expect(placeTooltip({ element: pin }, bubble, viewport, 'above')).toEqual({ top: 254, left: 382, side: 'above', arrowX: 18 });
    });

    it('flips below it near the top edge', () => {
      expect(placeTooltip({ element: { ...pin, top: 20 } }, bubble, viewport, 'above')).toMatchObject({ top: 50, side: 'below' });
    });

    it('shifts to stay on screen while its caret keeps pointing at the element', () => {
      expect(placeTooltip({ element: { ...pin, left: 975 } }, bubble, viewport, 'above')).toMatchObject({ left: 792, arrowX: 186 });
    });
  });
});
