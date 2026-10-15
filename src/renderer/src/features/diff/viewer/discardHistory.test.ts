import { describe, expect, it } from 'vitest';
import { DiscardHistory } from './discardHistory';

describe('DiscardHistory', () => {
  it('undoes the newest discard of a file first', () => {
    const history = new DiscardHistory();
    const first = { before: 'a', after: 'b' };
    const second = { before: 'b', after: 'c' };
    history.record('/wk', 'x.cs', first);
    history.record('/wk', 'x.cs', second);
    expect(history.last('/wk', 'x.cs')).toBe(second);
    history.forget('/wk', 'x.cs', second);
    expect(history.last('/wk', 'x.cs')).toBe(first);
    history.forget('/wk', 'x.cs', first);
    expect(history.last('/wk', 'x.cs')).toBeUndefined();
  });

  it('keeps each file of each workspace apart', () => {
    const history = new DiscardHistory();
    const discard = { before: 'a', after: 'b' };
    history.record('/wk', 'y.cs', discard);
    expect(history.last('/wk', 'z.cs')).toBeUndefined();
    expect(history.last('/other', 'y.cs')).toBeUndefined();
    expect(history.last('/wk', 'y.cs')).toBe(discard);
  });

  it('forgets an older discard undone from its toast, keeping the newer ones', () => {
    const history = new DiscardHistory();
    const older = { before: 'a', after: 'b' };
    const newer = { before: 'b', after: 'c' };
    history.record('/wk', 'w.cs', older);
    history.record('/wk', 'w.cs', newer);
    history.forget('/wk', 'w.cs', older);
    expect(history.last('/wk', 'w.cs')).toBe(newer);
  });

  it('lets the oldest discards of any file go past its size, keeping the newest even when it alone is larger', () => {
    const history = new DiscardHistory(10);
    const first = { before: 'aaa', after: 'bb' };
    const second = { before: 'cc', after: 'dd' };
    history.record('/wk', 'x.cs', first);
    history.record('/wk', 'y.cs', second);
    expect([history.last('/wk', 'x.cs'), history.last('/wk', 'y.cs')]).toEqual([first, second]);

    const third = { before: 'eeee', after: 'f' };
    history.record('/wk', 'y.cs', third);
    expect([history.last('/wk', 'x.cs'), history.last('/wk', 'y.cs')]).toEqual([undefined, third]);
    history.forget('/wk', 'y.cs', third);
    expect(history.last('/wk', 'y.cs')).toBe(second);

    const huge = { before: 'g'.repeat(20), after: 'h' };
    history.record('/wk', 'z.cs', huge);
    expect([history.last('/wk', 'y.cs'), history.last('/wk', 'z.cs')]).toEqual([undefined, huge]);
  });

  it("forgets a workspace's discards once the window leaves it, keeping the other workspaces'", () => {
    const history = new DiscardHistory();
    const left = { before: 'a', after: 'b' };
    const kept = { before: 'c', after: 'd' };
    history.record('/wk/game', 'x.cs', left);
    history.record('/wk/tools', 'x.cs', kept);

    history.forgetWorkspace('/wk/game');

    expect([history.last('/wk/game', 'x.cs'), history.last('/wk/tools', 'x.cs')]).toEqual([undefined, kept]);
  });
});
