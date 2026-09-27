import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { offersBackup, suggestsBackup, undoConsequences } from './undoPlan';

function change(path: string, kinds: PendingChange['kinds'], itemType: PendingChange['itemType'] = 'file'): PendingChange {
  return { path, kinds, itemType, size: 1, lastModified: '' };
}

describe('undoConsequences', () => {
  it('explains each kind of change, in singular or plural', () => {
    const lines = undoConsequences([
      change('a.ts', ['checkedOut', 'changed']),
      change('b.ts', ['changed']),
      change('new.ts', ['added']),
      change('moved.ts', ['moved']),
      change('gone.ts', ['deleted']),
      change('co.ts', ['checkedOut']),
    ]);
    expect(lines).toEqual([
      'Local edits to 2 files are lost.',
      '1 added item becomes a private file and stays on disk.',
      '1 moved item goes back to its old path.',
      '1 deleted item is restored.',
      '1 checkout without edits is released.',
    ]);
  });

  it('counts a moved and edited file both as moved and as edited', () => {
    expect(undoConsequences([change('a.ts', ['moved', 'changed']), change('b.ts', ['moved'])])).toEqual([
      'Local edits to 1 file are lost.',
      '2 moved items go back to their old paths.',
    ]);
  });
});

describe('suggestsBackup', () => {
  it('suggests a backup when text edits would be lost', () => {
    expect(suggestsBackup([change('a.ts', ['changed'])])).toBe(true);
  });

  it('does not for binary edits, additions or moves alone', () => {
    expect(suggestsBackup([change('a.png', ['changed'], 'binaryFile'), change('b.ts', ['added', 'changed']), change('c.ts', ['moved'])])).toBe(false);
  });

  it('suggests a backup for many changes of any kind', () => {
    expect(suggestsBackup(Array.from({ length: 11 }, (_, index) => change(`${index}.ts`, ['moved'])))).toBe(true);
  });
});

describe('offersBackup', () => {
  it('offers no backup when undoing only releases checkouts without edits, however many', () => {
    expect(offersBackup([change('a.ts', ['checkedOut'])])).toBe(false);
    expect(offersBackup(Array.from({ length: 11 }, (_, index) => change(`${index}.ts`, ['checkedOut'])))).toBe(false);
  });

  it('offers one as soon as anything else would be undone', () => {
    expect(offersBackup([change('a.ts', ['checkedOut']), change('b.ts', ['moved'])])).toBe(true);
  });
});
