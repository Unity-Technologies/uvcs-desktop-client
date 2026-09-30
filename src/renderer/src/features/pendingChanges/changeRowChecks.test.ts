import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { rowCheckState, spaceToggle } from './changeRowChecks';
import { layoutChangeRows, type ChangeRow } from './changeRows';

const change = (path: string, kinds: PendingChange['kinds'] = ['changed']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '' });

const rows = layoutChangeRows({
  changes: [change('src/a.ts'), change('src/b.ts'), change('bin/out.dll', ['ignored'])],
  changelists: [],
  layout: 'tree',
  grouping: 'none',
});
const row = (key: string): ChangeRow => rows.find((candidate) => candidate.key === key)!;
const checkedPaths = (paths: string[]) => (candidate: ChangeRow) => rowCheckState(candidate, (item) => paths.includes(item.path));

describe('spaceToggle', () => {
  it('checks the selected files unless every one already is', () => {
    const selected = [row('change:src/a.ts'), row('change:src/b.ts')];
    expect(spaceToggle(selected, selected[0], checkedPaths(['src/a.ts']))).toEqual({ rows: selected, include: true });
    expect(spaceToggle(selected, selected[0], checkedPaths(['src/a.ts', 'src/b.ts']))).toEqual({ rows: selected, include: false });
  });

  it('with no file selected, toggles the folder the keyboard is on, over what it holds', () => {
    const folder = row('directory:all:src');
    expect(spaceToggle([], folder, checkedPaths(['src/a.ts']))).toEqual({ rows: [folder], include: true });
    expect(spaceToggle([], folder, checkedPaths(['src/a.ts', 'src/b.ts']))).toEqual({ rows: [folder], include: false });
  });

  it('leaves a folder holding nothing to check in alone', () => {
    expect(spaceToggle([], row('directory:all:bin'), checkedPaths([]))).toEqual({ rows: [], include: false });
  });
});
