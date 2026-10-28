import { describe, expect, it } from 'vitest';
import { paneRole, sizedPaneStyle } from './splitPaneSize';

describe('sizedPaneStyle', () => {
  it('keeps the size, leaving the other pane at least the minimum however narrow the split gets', () => {
    expect(sizedPaneStyle(true, 720, 300)).toEqual({ width: 720, maxWidth: 'calc(100% - 300px)' });
  });

  it('caps the height of a vertical split the same way', () => {
    expect(sizedPaneStyle(false, 900, 120)).toEqual({ height: 900, maxHeight: 'calc(100% - 120px)' });
  });
});

describe('sizedPaneStyle with room kept for the other pane', () => {
  it('gives way first, down to its own minimum', () => {
    expect(sizedPaneStyle(true, 400, 260, 480)).toEqual({ width: 400, maxWidth: 'max(260px, calc(100% - 480px))' });
  });
});

describe('paneRole', () => {
  it('keeps the sized pane at its size and gives the other the rest while both show', () => {
    expect(paneRole('first', 'first', undefined)).toBe('sized');
    expect(paneRole('second', 'first', undefined)).toBe('rest');
  });

  it('gives the whole split to the pane left when the sized one hides (the details beside a list)', () => {
    expect(paneRole('second', 'second', 'second')).toBe('hidden');
    expect(paneRole('first', 'second', 'second')).toBe('rest');
  });

  it('gives the whole split to the sized pane when the other hides (a file tree whose details hide)', () => {
    expect(paneRole('second', 'first', 'second')).toBe('hidden');
    expect(paneRole('first', 'first', 'second')).toBe('rest');
  });
});
