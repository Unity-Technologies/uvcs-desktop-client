import { describe, expect, it } from 'vitest';
import { followTip } from './followTip';

const shown = { text: 'cs:28 on /main', sub: 'Click to copy cs:28', pointerX: 10, pointerY: 20 };

describe('followTip', () => {
  it('keeps the tooltip as it is while its element says the same', () => {
    expect(followTip(shown, { text: 'cs:28 on /main', sub: 'Click to copy cs:28' })).toBe(shown);
  });

  it('says what the element says now, where it showed', () => {
    expect(followTip(shown, { text: 'cs:24 on /main/experiment', sub: 'Click to copy cs:24' })).toEqual({
      text: 'cs:24 on /main/experiment',
      sub: 'Click to copy cs:24',
      shortcut: undefined,
      pointerX: 10,
      pointerY: 20,
    });
  });

  it('drops a second line or a shortcut the element no longer has', () => {
    expect(followTip({ ...shown, shortcut: 'mod+k' }, { text: 'cs:28 on /main' })).toEqual({
      text: 'cs:28 on /main',
      sub: undefined,
      shortcut: undefined,
      pointerX: 10,
      pointerY: 20,
    });
  });

  it('shows the move the element names now, and keeps the one it still names', () => {
    const moved = { text: '', move: { from: 'src/lib/A.cs', to: 'src/app/A.cs' }, pointerX: 10, pointerY: 20 };
    expect(followTip(moved, { text: '', move: { from: 'src/lib/A.cs', to: 'src/app/A.cs' } })).toBe(moved);
    expect(followTip(moved, { text: '', move: { from: 'src/lib/B.cs', to: 'src/app/B.cs' } })?.move).toEqual({ from: 'src/lib/B.cs', to: 'src/app/B.cs' });
    expect(followTip(moved, { text: 'src/app/A.cs' })?.move).toBeUndefined();
  });

  it('goes away with its element, or once the element has no tip', () => {
    expect(followTip(shown, null)).toBeNull();
  });
});
