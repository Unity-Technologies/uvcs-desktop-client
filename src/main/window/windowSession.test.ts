import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SavedWindow } from '@shared/domain/settings';
import { inSessionOrder, windowsToReopen } from './windowSession';

const GAME = join('/work', 'game');
const TOOLS = join('/work', 'tools');
const BOUNDS = { x: 0, y: 0, width: 1200, height: 800, maximized: false };

const on = (workspacePath: string | undefined, x = 0): SavedWindow => ({ workspacePath, bounds: { ...BOUNDS, x }, fullScreen: false });

describe('windowsToReopen', () => {
  it('reopens every saved window, home screens too, in their order', () => {
    const saved = [on(GAME), on(undefined), on(undefined), on(TOOLS)];

    expect(windowsToReopen(saved, () => true)).toEqual(saved);
  });

  it('leaves out a workspace whose folder is gone', () => {
    expect(windowsToReopen([on(GAME), on(TOOLS)], (path) => path !== GAME)).toEqual([on(TOOLS)]);
  });

  it('reopens a workspace saved twice once, where it was last, as one window shows each workspace', () => {
    expect(windowsToReopen([on(GAME, 10), on(TOOLS), on(GAME, 20)], () => true)).toEqual([on(TOOLS), on(GAME, 20)]);
  });

  it('reopens nothing when nothing was saved', () => {
    expect(windowsToReopen([], () => true)).toEqual([]);
  });
});

describe('inSessionOrder', () => {
  it('keeps the opening order, the focused window moved last', () => {
    expect(inSessionOrder(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });

  it('keeps the opening order when no window had the focus', () => {
    expect(inSessionOrder(['a', 'b'], null)).toEqual(['a', 'b']);
  });
});
