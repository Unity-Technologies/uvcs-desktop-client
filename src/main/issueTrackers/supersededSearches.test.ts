import { describe, expect, it } from 'vitest';
import { SupersededSearches } from './supersededSearches';

describe('SupersededSearches', () => {
  it('aborts an owner’s running search when a new one starts, and no other owner’s', () => {
    const searches = new SupersededSearches();
    const first = searches.start('1:game');
    const elsewhere = searches.start('2:game');
    const second = searches.start('1:game');
    expect([first.aborted, elsewhere.aborted, second.aborted]).toEqual([true, false, false]);
  });

  it('forgets a search that ended, but not the newer one that replaced it', () => {
    const searches = new SupersededSearches();
    const first = searches.start('1:game');
    const second = searches.start('1:game');
    searches.finish('1:game', first);
    expect(searches.size).toBe(1);
    searches.finish('1:game', second);
    expect(searches.size).toBe(0);
  });
});
