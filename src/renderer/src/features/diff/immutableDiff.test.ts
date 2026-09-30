import { describe, expect, it } from 'vitest';
import { isImmutableDiff } from './immutableDiff';

describe('isImmutableDiff', () => {
  it('keeps what history, a shelve or a range of changesets changed', () => {
    expect(isImmutableDiff({ kind: 'changeset', changesetId: 42 }, undefined)).toBe(true);
    expect(isImmutableDiff({ kind: 'shelve', shelveId: 3 }, undefined)).toBe(true);
    expect(isImmutableDiff({ kind: 'range', fromSpec: 'cs:1', toSpec: 'cs:5' }, undefined)).toBe(true);
  });

  it('keeps a branch only at a known head: without it, the branch may move', () => {
    expect(isImmutableDiff({ kind: 'branch', branch: '/main/task' }, 120)).toBe(true);
    expect(isImmutableDiff({ kind: 'branch', branch: '/main/task' }, undefined)).toBe(false);
  });
});
