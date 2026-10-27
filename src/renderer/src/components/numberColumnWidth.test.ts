import { describe, expect, it } from 'vitest';
import { numberColumnWidth } from './numberColumnWidth';

describe('numberColumnWidth', () => {
  it('grows with the digits of the longest number', () => {
    expect(numberColumnWidth(48)).toBe(41);
    expect(numberColumnWidth(280536)).toBe(74);
    expect(numberColumnWidth(1_204_377)).toBe(82);
  });

  it('is never narrower than the cell padding and one digit', () => {
    expect(numberColumnWidth(0)).toBe(33);
  });
});
