import { describe, expect, it } from 'vitest';
import { isPaletteTextKey } from './paletteTextKeys';

const key = (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}) => ({ key, ctrlKey: false, metaKey: false, ...modifiers });

describe('isPaletteTextKey', () => {
  it('leaves Home and End to the field, to move its caret or select with Shift', () => {
    expect(isPaletteTextKey(key('Home'))).toBe(true);
    expect(isPaletteTextKey(key('End'))).toBe(true);
  });

  it('lets ⌘ or Ctrl with them reach the first and last result', () => {
    expect(isPaletteTextKey(key('Home', { ctrlKey: true }))).toBe(false);
    expect(isPaletteTextKey(key('End', { metaKey: true }))).toBe(false);
  });

  it('leaves the list its own keys', () => {
    expect(isPaletteTextKey(key('ArrowDown'))).toBe(false);
    expect(isPaletteTextKey(key('Enter'))).toBe(false);
  });
});
