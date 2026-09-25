import { describe, expect, it } from 'vitest';
import { chipsFit } from './chipsFit';

describe('chipsFit', () => {
  it('fits when the whole name and every chip with its gap have room', () => {
    expect(chipsFit({ available: 200, nameWidth: 120, chipWidths: [40, 28], gap: 6 })).toBe(true);
  });

  it("doesn't fit when the chips would take room from the name", () => {
    expect(chipsFit({ available: 180, nameWidth: 120, chipWidths: [40, 28], gap: 6 })).toBe(false);
  });

  it('always fits without chips when the name does', () => {
    expect(chipsFit({ available: 120, nameWidth: 120, chipWidths: [], gap: 6 })).toBe(true);
  });
});
