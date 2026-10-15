import { describe, expect, it } from 'vitest';
import { migrateDiffPreferences } from '../diffPreferencesStore';
import { clickedSurface, diffsCompares, materialsButtonLabel, shownSurface, surfaceButtonDisabledReason, surfaceButtonOn } from './surfaceLook';

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

  it('shows a button on only while its look is chosen and can show: in Diffs slot colors never are', () => {
    expect(surfaceButtonOn('materials', 'materials', false)).toBe(true);
    expect(surfaceButtonOn('materials', 'slotColors', false)).toBe(false);
    expect(surfaceButtonOn('materials', 'materials', true)).toBe(true);
    expect(surfaceButtonOn('slotColors', 'slotColors', true)).toBe(false);
  });

  it('says why slot colors are off in Diffs, and only there: the materials compare the looks', () => {
    expect(surfaceButtonDisabledReason('slotColors', true)).toBe('Off in Diffs: its colors show what changed');
    expect(surfaceButtonDisabledReason('slotColors', false)).toBeNull();
    expect(surfaceButtonDisabledReason('materials', true)).toBeNull();
    expect(materialsButtonLabel(true)).toBe('Compare materials and textures');
    expect(materialsButtonLabel(false)).toBe('Show materials and textures');
  });

  it('makes Diffs compare how the versions look with the materials shown, and their shape otherwise', () => {
    expect(diffsCompares('materials')).toBe('look');
    expect(diffsCompares('clay')).toBe('shape');
    expect(diffsCompares('slotColors')).toBe('shape');
  });

  it('is remembered across sessions, slot colors chosen before there were materials kept', () => {
    expect(migrateDiffPreferences({ modelColorBySlot: true, modelDrawMode: 'wireframe' }, 0)).toEqual({ modelSurface: 'slotColors', modelDrawMode: 'wireframe' });
    expect(migrateDiffPreferences({ modelColorBySlot: false }, 0)).toEqual({ modelSurface: 'clay' });
    expect(migrateDiffPreferences(undefined, 0)).toEqual({ modelSurface: 'clay' });
    expect(migrateDiffPreferences({ modelSurface: 'materials' }, 1)).toEqual({ modelSurface: 'materials' });
  });
});
