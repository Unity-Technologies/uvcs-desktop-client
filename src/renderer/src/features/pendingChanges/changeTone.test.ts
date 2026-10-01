import { describe, expect, it } from 'vitest';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { changeStatus, changeTones } from './changeTone';

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
