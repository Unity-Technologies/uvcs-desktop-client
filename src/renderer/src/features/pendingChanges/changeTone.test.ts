import { describe, expect, it } from 'vitest';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { changeStatus, changeTones, PENDING_CHANGE_FACTS } from './changeTone';

const change = (...kinds: ChangeKind[]): PendingChange => ({ path: 'src/app/a.ts', oldPath: 'src/lib/a.ts', kinds, itemType: 'file', size: 1, lastModified: '' });

describe('changeStatus', () => {
  it('letters a change by its category, its kinds in the tooltip', () => {
    expect(changeStatus(change('checkedOut', 'changed'))).toEqual({ tone: 'changed', label: 'Checked out, Changed' });
    expect(changeStatus(change('moved'))).toEqual({ tone: 'moved', label: 'Moved' });
  });

  it('gives a moved file that changed a C before its M, each naming its own kinds', () => {
    expect(changeStatus(change('moved', 'changed'))).toEqual({ tone: 'moved', label: 'Moved', changedLabel: 'Changed' });
    expect(changeStatus(change('checkedOut', 'locallyMoved', 'replaced'))).toEqual({ tone: 'moved', label: 'Checked out, Moved locally', changedLabel: 'Replaced' });
  });

  it('gives no C to a moved file only checked out, nor to a deleted one', () => {
    expect(changeStatus(change('checkedOut', 'moved')).changedLabel).toBeUndefined();
    expect(changeStatus(change('moved', 'changed', 'deleted'))).toEqual({ tone: 'deleted', label: 'Moved, Changed, Deleted' });
  });
});

describe('changeTones', () => {
  it('finds a moved file that changed by the C and M chips, any other by its letter', () => {
    expect(changeTones(change('moved', 'changed'))).toEqual(['changed', 'moved']);
    expect(changeTones(change('moved'))).toEqual(['moved']);
    expect(changeTones(change('changed'))).toEqual(['changed']);
  });
});

describe("a pending change's date", () => {
  it('is when its file was last modified on disk', () => {
    expect(PENDING_CHANGE_FACTS.dateOf!({ ...change('changed'), lastModified: '2026-11-24T10:00:00.000Z' })).toBe(Date.UTC(2026, 10, 24, 10));
  });

  it('is none for what has no file on disk (a deleted file, a folder)', () => {
    expect(PENDING_CHANGE_FACTS.dateOf!(change('deleted'))).toBeUndefined();
  });
});
