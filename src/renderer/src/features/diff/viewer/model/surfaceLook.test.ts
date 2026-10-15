import { describe, expect, it } from 'vitest';
import { migrateDiffPreferences } from '../diffPreferencesStore';
import { clickedSurface, shownSurface, surfaceButtonDisabledReason, surfaceButtonOn } from './surfaceLook';

describe('the surface look', () => {
  it('is one choice: a button turns its look on and the other off, and clicked again goes back to clay', () => {
    expect(clickedSurface('clay', 'materials')).toBe('materials');
    expect(clickedSurface('slotColors', 'materials')).toBe('materials');
    expect(clickedSurface('materials', 'slotColors')).toBe('slotColors');
    expect(clickedSurface('materials', 'materials')).toBe('clay');
    expect(clickedSurface('slotColors', 'slotColors')).toBe('clay');
  });

  it("shows clay for a model whose materials show nothing more, keeping the choice for the next", () => {
    expect(shownSurface('materials', false)).toBe('clay');
    expect(shownSurface('materials', true)).toBe('materials');
    expect(shownSurface('slotColors', false)).toBe('slotColors');
  });

  it('shows a button on only while its look is chosen and can show: in Diffs none is on', () => {
    expect(surfaceButtonOn('materials', 'materials', false)).toBe(true);
    expect(surfaceButtonOn('materials', 'slotColors', false)).toBe(false);
    expect(surfaceButtonOn('materials', 'materials', true)).toBe(false);
  });

  it('says why its buttons are off in Diffs, and only there', () => {
    expect(surfaceButtonDisabledReason(true)).toBe('Off in Diffs: its colors show what changed');
    expect(surfaceButtonDisabledReason(false)).toBeNull();
  });

  it('is remembered across sessions, slot colors chosen before there were materials kept', () => {
    expect(migrateDiffPreferences({ modelColorBySlot: true, modelDrawMode: 'wireframe' }, 0)).toEqual({ modelSurface: 'slotColors', modelDrawMode: 'wireframe' });
    expect(migrateDiffPreferences({ modelColorBySlot: false }, 0)).toEqual({ modelSurface: 'clay' });
    expect(migrateDiffPreferences(undefined, 0)).toEqual({ modelSurface: 'clay' });
    expect(migrateDiffPreferences({ modelSurface: 'materials' }, 1)).toEqual({ modelSurface: 'materials' });
  });
});
