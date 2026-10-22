import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { candidatesUnderRow, checkStateOver, spaceToggle } from './changeRowChecks';
import { sortChanges } from './changeOrder';
import { layoutChangeRows, type ChangeRow } from './changeRows';

const change = (path: string, kinds: PendingChange['kinds'] = ['changed']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '' });

const rows = layoutChangeRows({
  sorted: sortChanges([change('src/a.ts'), change('src/b.ts'), change('bin/out.dll', ['ignored'])]),
  changelists: [],
  layout: 'tree',
  grouping: 'none',
});
const row = (key: string): ChangeRow => rows.find((candidate) => candidate.key === key)!;
const checkedPaths = (paths: string[]) => (candidate: ChangeRow) => checkStateOver(candidatesUnderRow(candidate), (item) => paths.includes(item.path));

describe('spaceToggle', () => {
  it('checks the selected files unless every one already is', () => {
    const selected = [row('change:src/a.ts'), row('change:src/b.ts')];
    expect(spaceToggle(selected, selected[0], checkedPaths(['src/a.ts']))).toEqual({ rows: selected, include: true });
    expect(spaceToggle(selected, selected[0], checkedPaths(['src/a.ts', 'src/b.ts']))).toEqual({ rows: selected, include: false });
  });

  it('with no file selected, toggles the folder the keyboard is on, over what it holds', () => {
    const folder = row('folder:all:src');
    expect(spaceToggle([], folder, checkedPaths(['src/a.ts']))).toEqual({ rows: [folder], include: true });
    expect(spaceToggle([], folder, checkedPaths(['src/a.ts', 'src/b.ts']))).toEqual({ rows: [folder], include: false });
  });

  it('leaves a folder holding nothing to check in alone', () => {
    expect(spaceToggle([], row('folder:all:bin'), checkedPaths([]))).toEqual({ rows: [], include: false });
  });
});

describe('checkStateOver', () => {
  it("checks a folder over what it holds that can go in, and tells a folder of thousands checked at once while every box is", () => {
    const folder = row('folder:all:src');
    const candidates = candidatesUnderRow(folder);
    let asked = 0;

    expect(checkStateOver(candidates, (item) => (asked++, item.path === 'src/a.ts'))).toBe('mixed');
    expect(asked).toBe(2);
    expect(checkStateOver(candidates, null)).toBe(true);
    expect(checkStateOver(candidatesUnderRow(row('folder:all:bin')), null)).toBeNull();
  });
});
