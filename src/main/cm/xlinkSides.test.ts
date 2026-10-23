import { describe, expect, it } from 'vitest';
import { recordsOutput } from './testing/cmOutput';
import { TREE_ITEMS } from './treeItems';
import { FOUND_PARENTS, parentPointOf, readsSide, xlinkAfterPoint, xlinkBeforePoint, xlinkIn, xlinkListArgs } from './xlinkSides';

/** A `cm ls --tree` listing as `cm` prints it: server paths, an xlink named after its target, the folder itself as `.`. */
function listing(...items: { wkpath: string; name: string; type?: string }[]): string {
  return recordsOutput(TREE_ITEMS, { name: '.', wkpath: '/plugins', type: 'dir' }, ...items.map(({ type = 'dir', ...item }) => ({ ...item, type })));
}

describe('The sides of a diff an xlink is read at', () => {
  it('reads a changeset at itself and at its parent, which a cm find names', () => {
    expect(xlinkAfterPoint({ kind: 'changeset', changesetId: 37 })).toEqual({ kind: 'point', spec: 'cs:37' });
    const before = xlinkBeforePoint({ kind: 'changeset', changesetId: 37 });
    expect(before).toMatchObject({ kind: 'parentOf' });
    expect(before?.kind === 'parentOf' && before.findArgs.slice(0, 3)).toEqual(['find', 'changeset', 'where changesetid = 37']);
    expect(before?.kind === 'parentOf' && before.findArgs.filter((arg) => arg.startsWith('--format'))).toEqual([expect.not.stringMatching(/comment|owner|date|guid/)]);
  });

  it("reads a branch at its head and where it started: the parent of its first changeset", () => {
    expect(xlinkAfterPoint({ kind: 'branch', branch: '/main/task1' })).toEqual({ kind: 'point', spec: 'br:/main/task1' });
    const before = xlinkBeforePoint({ kind: 'branch', branch: '/main/task1' });
    expect(before?.kind === 'parentOf' && before.findArgs[2]).toBe("where branch = '/main/task1' order by changesetid asc limit 1");
  });

  it("names the repository on the find of the side before, where no workspace tells cm which: last, after the limit", () => {
    const branch = xlinkBeforePoint({ kind: 'branch', branch: '/main/task1' }, 'game@local');
    expect(branch?.kind === 'parentOf' && branch.findArgs[2]).toBe("where branch = '/main/task1' order by changesetid asc limit 1 on repository 'game@local'");
    const changeset = xlinkBeforePoint({ kind: 'changeset', changesetId: 37 }, 'game@local');
    expect(changeset?.kind === 'parentOf' && changeset.findArgs[2]).toBe("where changesetid = 37 on repository 'game@local'");
  });

  it('reads a range at its two points, and a shelve at neither', () => {
    const range = { kind: 'range', fromSpec: 'cs:10', toSpec: 'lb:v1.0' } as const;
    expect([xlinkBeforePoint(range), xlinkAfterPoint(range)]).toEqual([
      { kind: 'point', spec: 'cs:10' },
      { kind: 'point', spec: 'lb:v1.0' },
    ]);
    expect([xlinkBeforePoint({ kind: 'shelve', shelveId: 3 }), xlinkAfterPoint({ kind: 'shelve', shelveId: 3 })]).toEqual([null, null]);
  });

  it('names the found changeset parent as a point; none before the first changeset', () => {
    expect(parentPointOf(recordsOutput(FOUND_PARENTS, { parent: 279866 }))).toBe('cs:279866');
    expect(parentPointOf(recordsOutput(FOUND_PARENTS, { parent: -1 }))).toBeNull();
    expect(parentPointOf('')).toBeNull();
  });
});

describe('Which sides are read', () => {
  const point = { kind: 'point', spec: 'cs:10' } as const;

  it('skips the side an added or deleted xlink is not on', () => {
    expect(readsSide(point, 'before', 'added')).toBe(false);
    expect(readsSide(point, 'after', 'added')).toBe(true);
    expect(readsSide(point, 'after', 'deleted')).toBe(false);
    expect(readsSide(point, 'before', 'deleted')).toBe(true);
  });

  it('skips a point whose tree cm ls refuses (a label), and a side there is no point for', () => {
    expect(readsSide({ kind: 'point', spec: 'lb:v1.0' }, 'after', 'changed')).toBe(false);
    expect(readsSide({ kind: 'point', spec: 'br:/main' }, 'after', 'changed')).toBe(true);
    expect(readsSide(null, 'before', 'changed')).toBe(false);
  });
});

describe('Where an xlink points in a listing', () => {
  it('lists the folder holding the xlink, the repository root for one at the top', () => {
    expect(xlinkListArgs('src/plugins/unity-plugin', 'cs:12').slice(0, 3)).toEqual(['ls', '/src/plugins', '--tree=cs:12']);
    expect(xlinkListArgs('pnunit', 'br:/main').slice(0, 2)).toEqual(['ls', '/']);
  });

  it('reads the target from the name cm gives the xlink, writable and relative', () => {
    const output = listing(
      { wkpath: '/plugins/other', name: 'other' },
      { wkpath: '/plugins/unity-plugin', name: 'unity-plugin -> wxlink -> / 17361@unityGUI@ [relative] codice@cloud' },
    );
    expect(xlinkIn(output, 'plugins/unity-plugin')).toEqual({ writable: true, path: '/', changeset: 17361, repository: 'unityGUI', server: 'codice@cloud' });
  });

  it('reads a read-only xlink to a folder of the other repository', () => {
    const output = listing({ wkpath: '/plugins/lib', name: 'lib -> xlink -> /src 42@thirdparty@local' });
    expect(xlinkIn(output, 'plugins/lib')).toEqual({ writable: false, path: '/src', changeset: 42, repository: 'thirdparty', server: 'local' });
  });

  it('finds none where the path is a plain folder or missing', () => {
    expect(xlinkIn(listing({ wkpath: '/plugins/lib', name: 'lib' }), 'plugins/lib')).toBeNull();
    expect(xlinkIn(listing(), 'plugins/lib')).toBeNull();
  });
});
