import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { gridKeyAction } from './permissionGridKeys';

const press = (key: string, modifiers: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  key,
  code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('the permission grid keys', () => {
  it('moves between permissions with the arrows, Home and End', () => {
    expect(gridKeyAction(press('ArrowDown'), 2, 10, 'inherit')).toEqual({ kind: 'move', index: 3 });
    expect(gridKeyAction(press('ArrowUp'), 0, 10, 'inherit')).toEqual({ kind: 'move', index: 0 });
    expect(gridKeyAction(press('End'), 2, 10, 'inherit')).toEqual({ kind: 'move', index: 9 });
    expect(gridKeyAction(press('Home'), 2, 10, 'inherit')).toEqual({ kind: 'move', index: 0 });
  });

  it('picks a state with A, D and I, and steps through them with ← →, wrapping around', () => {
    expect(gridKeyAction(press('a'), 0, 5, 'inherit')).toEqual({ kind: 'set', state: 'allow' });
    expect(gridKeyAction(press('d'), 0, 5, 'inherit')).toEqual({ kind: 'set', state: 'deny' });
    expect(gridKeyAction(press('i'), 0, 5, 'deny')).toEqual({ kind: 'set', state: 'inherit' });
    expect(gridKeyAction(press('ArrowRight'), 0, 5, 'inherit')).toEqual({ kind: 'set', state: 'allow' });
    expect(gridKeyAction(press('ArrowRight'), 0, 5, 'deny')).toEqual({ kind: 'set', state: 'inherit' });
    expect(gridKeyAction(press('ArrowLeft'), 0, 5, 'inherit')).toEqual({ kind: 'set', state: 'deny' });
  });

  it('leaves other keys and chords to the window', () => {
    expect(gridKeyAction(press('a', { metaKey: true }), 0, 5, 'inherit')).toBeNull();
    expect(gridKeyAction(press('Home', { metaKey: true }), 3, 5, 'inherit')).toBeNull();
    expect(gridKeyAction(press('x'), 0, 5, 'inherit')).toBeNull();
    expect(gridKeyAction(press('ArrowDown'), 0, 0, undefined)).toBeNull();
  });
});
