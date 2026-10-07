import '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { Action } from '../../../lib/actions';
import { UPDATE_LABELS } from '../../incoming/updateConflictFiles';
import { keepVersionEntries } from './keepVersionEntries';

describe('keepVersionEntries', () => {
  it("settles a conflicting file by keeping one side whole, in the sides' own words", () => {
    const decide = vi.fn();
    const entries = keepVersionEntries(['src/a.ts'], UPDATE_LABELS, decide) as Action[];
    expect(entries.map((entry) => entry.label)).toEqual(['Keep yours', 'Keep incoming']);
    entries[1]!.run();
    expect(decide).toHaveBeenCalledWith('src/a.ts', { kind: 'wholeFile', side: 'source' });
  });

  it('settles several conflicting files at once, saying how many', () => {
    const decide = vi.fn();
    const entries = keepVersionEntries(['a.ts', 'b.ts'], UPDATE_LABELS, decide) as Action[];
    expect(entries.map((entry) => entry.label)).toEqual(['Keep yours for 2 files', 'Keep incoming for 2 files']);
    entries[0]!.run();
    expect(decide.mock.calls).toEqual([
      ['a.ts', { kind: 'wholeFile', side: 'destination' }],
      ['b.ts', { kind: 'wholeFile', side: 'destination' }],
    ]);
  });

  it('offers nothing for files without conflicts', () => {
    expect(keepVersionEntries([], UPDATE_LABELS, vi.fn())).toEqual([]);
  });
});
