import { describe, expect, it } from 'vitest';
import { checklistKeyAction } from './checklistKeys';

describe('checklistKeyAction', () => {
  const state = { active: -1, rowCount: 3, browsing: false };

  it('moves through the rows with the arrows, staying within them', () => {
    expect(checklistKeyAction('ArrowDown', state)).toEqual({ kind: 'move', to: 0 });
    expect(checklistKeyAction('ArrowDown', { ...state, active: 2 })).toEqual({ kind: 'move', to: 2 });
    expect(checklistKeyAction('ArrowUp', { ...state, active: 0 })).toEqual({ kind: 'move', to: 0 });
  });

  it('toggles the row the arrows are on with Enter, the first one while only typing', () => {
    expect(checklistKeyAction('Enter', { ...state, active: 1 })).toEqual({ kind: 'toggle', index: 1 });
    expect(checklistKeyAction('Enter', state)).toEqual({ kind: 'toggle', index: 0 });
  });

  it('toggles with Space only after the arrows moved, so words can be typed', () => {
    expect(checklistKeyAction(' ', { ...state, active: 1 })).toEqual({ kind: 'type' });
    expect(checklistKeyAction(' ', { ...state, active: 1, browsing: true })).toEqual({ kind: 'toggle', index: 1 });
  });

  it('types everything else, and every key with no rows', () => {
    expect(checklistKeyAction('a', state)).toEqual({ kind: 'type' });
    expect(checklistKeyAction('Enter', { ...state, rowCount: 0 })).toEqual({ kind: 'type' });
  });
});
