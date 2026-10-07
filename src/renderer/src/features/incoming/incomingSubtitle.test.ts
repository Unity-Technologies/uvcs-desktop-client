import { describe, expect, it } from 'vitest';
import { incomingSubtitle } from './incomingSubtitle';

const read = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index }));

describe('incomingSubtitle', () => {
  it('counts the changesets the list read, as at least that many while older ones remain', () => {
    expect(incomingSubtitle('/main', { changesets: read(200), more: true })).toBe('200+ new on main');
  });

  it('counts exactly once the last page is in', () => {
    expect(incomingSubtitle('/main', { changesets: read(260), more: false })).toBe('260 new on main');
    expect(incomingSubtitle('/main/task', { changesets: read(3), more: false })).toBe('3 new on task');
  });
});
