import { describe, expect, it } from 'vitest';
import { focusOnPlace } from './useFocusUntilMoved';

describe('focusOnPlace', () => {
  const opened = { focus: 'L42' };

  it('keeps the focus while no place is known yet', () => {
    expect(focusOnPlace(opened, undefined)).toBe(opened);
  });

  it('keeps it on the first place known, the same state while it stays there', () => {
    const shown = focusOnPlace(opened, 'cs:2');
    expect(shown).toEqual({ focus: 'L42', firstPlace: 'cs:2' });
    expect(focusOnPlace(shown, 'cs:2')).toBe(shown);
  });

  it('drops it for good once another place shows, coming back included', () => {
    const moved = focusOnPlace(focusOnPlace(opened, 'cs:2'), 'cs:1');
    expect(moved.focus).toBeNull();
    expect(focusOnPlace(moved, 'cs:2')).toBe(moved);
  });

  it('has nothing to keep without a focus', () => {
    const none = { focus: null };
    expect(focusOnPlace(none, 'cs:2')).toBe(none);
  });
});
