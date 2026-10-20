import '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { Action } from '../../../lib/actions';
import { UPDATE_LABELS } from '../../incoming/updateConflictFiles';
import { keepVersionEntries } from './keepVersionEntries';

/** A conflicting file, with a base unless said otherwise. */
const file = (key: string, hasBase = true) => ({ key, hasBase });

describe('keepVersionEntries', () => {
  it("settles a conflicting file by keeping one side whole, in the sides' own words", () => {
    const decide = vi.fn();
    const entries = keepVersionEntries([file('src/a.ts')], UPDATE_LABELS, decide) as Action[];
    expect(entries.map((entry) => entry.label)).toEqual(['Keep yours', 'Keep incoming', 'Keep base']);
    entries[1]!.run();
    expect(decide).toHaveBeenCalledWith('src/a.ts', { kind: 'wholeFile', side: 'source' });
  });

  it('settles several conflicting files at once, saying how many', () => {
    const decide = vi.fn();
    const entries = keepVersionEntries([file('a.ts'), file('b.ts', false)], UPDATE_LABELS, decide) as Action[];
    expect(entries.map((entry) => entry.label)).toEqual(['Keep yours for 2 files', 'Keep incoming for 2 files']);
    entries[0]!.run();
    expect(decide.mock.calls).toEqual([
      ['a.ts', { kind: 'wholeFile', side: 'destination' }],
      ['b.ts', { kind: 'wholeFile', side: 'destination' }],
    ]);
  });

  it('keeps the base of every file selected, offered only when each of them has one', () => {
    const decide = vi.fn();
    const entries = keepVersionEntries([file('a.ts'), file('b.ts')], UPDATE_LABELS, decide) as Action[];
    expect(entries.map((entry) => entry.label)).toEqual(['Keep yours for 2 files', 'Keep incoming for 2 files', 'Keep base for 2 files']);
    entries[2]!.run();
    expect(decide.mock.calls).toEqual([
      ['a.ts', { kind: 'wholeFile', side: 'base' }],
      ['b.ts', { kind: 'wholeFile', side: 'base' }],
    ]);
  });

  it('offers nothing for files without conflicts', () => {
    expect(keepVersionEntries([], UPDATE_LABELS, vi.fn())).toEqual([]);
  });
});
