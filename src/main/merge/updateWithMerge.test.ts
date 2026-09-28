import { describe, expect, it } from 'vitest';
import type { UpdateConflict } from '@shared/domain/incoming';
import { unresolvedConflicts } from './updateWithMerge';

const conflict = (path: string): UpdateConflict => ({ path, isBinary: false, baseRevisionId: 1, incomingRevisionId: 2, repository: 'game@local' });

describe('unresolvedConflicts', () => {
  it('lists the files that need merging and have no resolution yet', () => {
    const conflicts = [conflict('a.ts'), conflict('b.ts')];
    expect(unresolvedConflicts(conflicts, { 'a.ts': { choice: 'source' } })).toEqual([conflict('b.ts')]);
    expect(unresolvedConflicts(conflicts, { 'a.ts': { choice: 'source' }, 'b.ts': { choice: 'text', text: 'merged\n' } })).toEqual([]);
  });

  it('takes no resolutions as none resolved, so shelving what blocks an update stops before updating', () => {
    expect(unresolvedConflicts([conflict('a.ts')], null)).toEqual([conflict('a.ts')]);
    expect(unresolvedConflicts([], null)).toEqual([]);
  });
});
