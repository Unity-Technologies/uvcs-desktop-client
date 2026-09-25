import { describe, expect, it } from 'vitest';
import { forgetDiscard, lastDiscard, recordDiscard } from './discardHistory';

describe('discardHistory', () => {
  it('undoes the newest discard of a file first', () => {
    const first = { before: 'a', after: 'b' };
    const second = { before: 'b', after: 'c' };
    recordDiscard('/wk', 'x.cs', first);
    recordDiscard('/wk', 'x.cs', second);
    expect(lastDiscard('/wk', 'x.cs')).toBe(second);
    forgetDiscard('/wk', 'x.cs', second);
    expect(lastDiscard('/wk', 'x.cs')).toBe(first);
    forgetDiscard('/wk', 'x.cs', first);
    expect(lastDiscard('/wk', 'x.cs')).toBeUndefined();
  });

  it('keeps each file of each workspace apart', () => {
    const discard = { before: 'a', after: 'b' };
    recordDiscard('/wk', 'y.cs', discard);
    expect(lastDiscard('/wk', 'z.cs')).toBeUndefined();
    expect(lastDiscard('/other', 'y.cs')).toBeUndefined();
    expect(lastDiscard('/wk', 'y.cs')).toBe(discard);
  });

  it('forgets an older discard undone from its toast, keeping the newer ones', () => {
    const older = { before: 'a', after: 'b' };
    const newer = { before: 'b', after: 'c' };
    recordDiscard('/wk', 'w.cs', older);
    recordDiscard('/wk', 'w.cs', newer);
    forgetDiscard('/wk', 'w.cs', older);
    expect(lastDiscard('/wk', 'w.cs')).toBe(newer);
  });
});
