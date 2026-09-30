import { describe, expect, it } from 'vitest';
import { windowsShowAnyOf } from './settings';

describe('windowsShowAnyOf', () => {
  it('tells the windows about any setting but the window bounds, saved as windows move', () => {
    expect(windowsShowAnyOf({ theme: 'dark' })).toBe(true);
    expect(windowsShowAnyOf({ theme: 'dark', windowBounds: null })).toBe(true);
    expect(windowsShowAnyOf({ windowBounds: null })).toBe(false);
  });
});
