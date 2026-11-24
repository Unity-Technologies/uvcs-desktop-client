import { describe, expect, it } from 'vitest';
import { countCharactersRead } from '@shared/testing/countCharactersRead';
import { mergedDiffEntries, readDiffEntry } from './diffEntries';
import { formatOutput, recordsIn } from './testing/cmOutput';

const diffEntriesIn = (output: string) => mergedDiffEntries(recordsIn(output, readDiffEntry));

const GAME = '"game@local"';

describe('reading diff entries', () => {
  it('reads added, changed and deleted items sorted by path', () => {
    const output =
      formatOutput(['A', '"/src/ui.ts"', '""', '-1', '36', 'F', GAME]) +
      formatOutput(['C', '"/assets/logo.png"', '""', '13', '37', 'B', GAME]) +
      formatOutput(['D', '"/docs/notes.md"', '""', '-1', '14', 'F', GAME]);

    expect(diffEntriesIn(output)).toEqual([
      { status: 'changed', path: 'assets/logo.png', oldPath: undefined, itemType: 'binaryFile', baseRevisionId: 13, revisionId: 37, repository: 'game@local' },
      { status: 'deleted', path: 'docs/notes.md', oldPath: undefined, itemType: 'file', baseRevisionId: 14, revisionId: -1, repository: 'game@local' },
      { status: 'added', path: 'src/ui.ts', oldPath: undefined, itemType: 'file', baseRevisionId: -1, revisionId: 36, repository: 'game@local' },
    ]);
  });

  it("reads the repository of items under an xlink: their revisions are the xlinked repository's", () => {
    // `cm diff br:/main/task1008583@acme@acme@cloud --repositorypaths --format=…`, where editor-plugin is an xlink to editorGUI.
    const output =
      formatOutput(['C', '"/.github/code-style.md"', '""', '31303681', '31327337', 'F', '"acme@acme@cloud"']) +
      formatOutput(['C', '"/01project/src/client/plugins/editor-plugin"', '""', '-1', '-1', 'X', '"acme@acme@cloud"']) +
      formatOutput([
        'C',
        '"/01project/src/client/plugins/editor-plugin/Packages/com.acme.editor.tests/Infrastructure/DiffWindowMockExtensions.cs"',
        '""',
        '425946',
        '432251',
        'F',
        '"editorGUI@acme@cloud"',
      ]) +
      formatOutput(['A', '"/01project/src/client/plugins/editor-plugin/TestPlans/TASK-1234.md"', '""', '-1', '432300', 'F', '"editorGUI@acme@cloud"']);

    expect(diffEntriesIn(output).map(({ path, itemType, baseRevisionId, revisionId, repository }) => ({ path, itemType, baseRevisionId, revisionId, repository }))).toEqual([
      { path: '.github/code-style.md', itemType: 'file', baseRevisionId: 31303681, revisionId: 31327337, repository: 'acme@acme@cloud' },
      { path: '01project/src/client/plugins/editor-plugin', itemType: 'xlink', baseRevisionId: -1, revisionId: -1, repository: 'acme@acme@cloud' },
      {
        path: '01project/src/client/plugins/editor-plugin/Packages/com.acme.editor.tests/Infrastructure/DiffWindowMockExtensions.cs',
        itemType: 'file',
        baseRevisionId: 425946,
        revisionId: 432251,
        repository: 'editorGUI@acme@cloud',
      },
      {
        path: '01project/src/client/plugins/editor-plugin/TestPlans/TASK-1234.md',
        itemType: 'file',
        baseRevisionId: -1,
        revisionId: 432300,
        repository: 'editorGUI@acme@cloud',
      },
    ]);
  });

  it('sorts numbered files as people read them', () => {
    const output = ['file_10.txt', 'file_2.txt', 'File_1.txt', 'file_100.txt'].map((name) => formatOutput(['A', `"/${name}"`, '""', '-1', '5', 'F', GAME])).join('');
    expect(diffEntriesIn(output).map((entry) => entry.path)).toEqual(['File_1.txt', 'file_2.txt', 'file_10.txt', 'file_100.txt']);
  });

  it('lists everything in a folder right after it, as every list of files does', () => {
    const output = ['a-b.txt', 'a/c.txt', 'a', 'ab'].map((path) => formatOutput(['A', `"/${path}"`, '""', '-1', '5', 'F', GAME])).join('');
    expect(diffEntriesIn(output).map((entry) => entry.path)).toEqual(['a', 'a/c.txt', 'a-b.txt', 'ab']);
  });

  it('shows the same revision on both sides of a pure move', () => {
    const [moved] = diffEntriesIn(formatOutput(['M', '"/docs/changelog.md"', '"/docs/notes.md"', '-1', '14', 'F', GAME]));
    expect(moved).toMatchObject({ status: 'moved', oldPath: 'docs/notes.md', baseRevisionId: 14, revisionId: 14 });
  });

  it('merges a moved and changed item into one entry', () => {
    const output = formatOutput(['C', '"/src/arith.ts"', '""', '55', '69', 'F', GAME]) + formatOutput(['M', '"/src/arith.ts"', '"/src/math.ts"', '-1', '69', 'F', GAME]);
    expect(diffEntriesIn(output)).toEqual([
      { status: 'moved', path: 'src/arith.ts', oldPath: 'src/math.ts', itemType: 'file', baseRevisionId: 55, revisionId: 69, repository: 'game@local' },
    ]);
  });

  it('reads a file deleted and another put at its path as one replaced entry: the deleted revision against the new one', () => {
    // `cm diff cs:282104 --repositorypaths --format=…`: the file added on the branch, deleted, and its path given back to
    // the item it was moved from, so its history follows that file's. `cm` prints A then D; either order reads the same.
    const added = formatOutput(['A', '"/src/ShelvesColumnComparers.cs"', '""', '-1', '31408478', 'F', GAME]);
    const deleted = formatOutput(['D', '"/src/ShelvesColumnComparers.cs"', '""', '-1', '31407468', 'F', GAME]);
    const replaced = { status: 'changed', path: 'src/ShelvesColumnComparers.cs', oldPath: undefined, itemType: 'file', baseRevisionId: 31407468, revisionId: 31408478, repository: 'game@local', replaced: true };

    expect(diffEntriesIn(added + deleted)).toEqual([replaced]);
    expect(diffEntriesIn(deleted + added)).toEqual([replaced]);
  });

  it('reads a path given to an item of another kind as it was read before, the added item: its older side would be no content', () => {
    // A folder deleted and a file added at its path, and the other way round: nothing to compare between the two.
    const folderGone = formatOutput(['D', '"/src/Score"', '""', '-1', '40', 'D', GAME]) + formatOutput(['A', '"/src/Score"', '""', '-1', '41', 'F', GAME]);
    const fileGone = formatOutput(['A', '"/src/Score"', '""', '-1', '41', 'D', GAME]) + formatOutput(['D', '"/src/Score"', '""', '-1', '40', 'F', GAME]);

    expect(diffEntriesIn(folderGone)).toEqual([{ status: 'added', path: 'src/Score', oldPath: undefined, itemType: 'file', baseRevisionId: -1, revisionId: 41, repository: 'game@local' }]);
    expect(diffEntriesIn(fileGone)).toEqual([{ status: 'added', path: 'src/Score', oldPath: undefined, itemType: 'directory', baseRevisionId: -1, revisionId: 41, repository: 'game@local' }]);
  });

  it('reads an item whose file permissions alone changed as the same revision on both sides, with its permissions', () => {
    // `cm` gives a change without a content change no base revision: `baserevid` is -1, as for an added item.
    const [entry] = diffEntriesIn(formatOutput(['C', '"/tools/build.sh"', '""', '-1', '41', 'F', GAME, '"-rw-r--r--"', '"-rwxr-xr-x"']));
    expect(entry).toEqual({
      status: 'changed',
      path: 'tools/build.sh',
      oldPath: undefined,
      itemType: 'file',
      baseRevisionId: 41,
      revisionId: 41,
      repository: 'game@local',
      permissionsChange: { before: '-rw-r--r--', after: '-rwxr-xr-x' },
    });
  });

  it('reads no permissions on a side that sets none', () => {
    // `cm` prints nothing for permissions never set, as on an item first checked in from Windows.
    const [entry] = diffEntriesIn(formatOutput(['C', '"/src/GitCredentials.cs"', '""', '-1', '41', 'F', GAME, '"-r--r--r--"', '""']));
    expect(entry?.permissionsChange).toEqual({ before: '-r--r--r--', after: null });
  });

  it('reads an item whose content and permissions changed as a plain change', () => {
    const [entry] = diffEntriesIn(formatOutput(['C', '"/tools/build.sh"', '""', '40', '41', 'F', GAME, '"-rw-r--r--"', '"-rwxr-xr-x"']));
    expect(entry).toMatchObject({ status: 'changed', baseRevisionId: 40, revisionId: 41 });
    expect(entry?.permissionsChange).toBeUndefined();
  });

  it('reads an item moved whose permissions alone changed as only moved', () => {
    const output =
      formatOutput(['C', '"/tools/build.sh"', '""', '-1', '41', 'F', GAME, '"-rw-r--r--"', '"-rwxr-xr-x"']) +
      formatOutput(['M', '"/tools/build.sh"', '"/build.sh"', '-1', '41', 'F', GAME, '"-rw-r--r--"', '"-rwxr-xr-x"']);
    expect(diffEntriesIn(output)).toEqual([
      { status: 'moved', path: 'tools/build.sh', oldPath: 'build.sh', itemType: 'file', baseRevisionId: 41, revisionId: 41, repository: 'game@local' },
    ]);
  });

  it("reads when each item's revision was made, as cm prints it in the round-trip format", () => {
    // `cm diff cs:41 --repositorypaths --format=… --dateformat=o`: a deleted item's date is its last revision's.
    const output =
      formatOutput(['C', '"/src/player.cs"', '""', '40', '41', 'F', GAME, '""', '""', '"2026-11-20T09:15:02.1234567+01:00"']) +
      formatOutput(['D', '"/src/enemy.cs"', '""', '-1', '12', 'F', GAME, '""', '""', '"2026-03-02T18:40:00.0000000+01:00"']);

    expect(diffEntriesIn(output).map(({ path, date }) => ({ path, date }))).toEqual([
      { path: 'src/enemy.cs', date: '2026-03-02T18:40:00.0000000+01:00' },
      { path: 'src/player.cs', date: '2026-11-20T09:15:02.1234567+01:00' },
    ]);
  });

  it('reads no date where cm prints none, or the empty date of a revision it knows nothing of', () => {
    const output =
      formatOutput(['C', '"/plugins/editor"', '""', '-1', '-1', 'X', GAME, '""', '""', '""']) +
      formatOutput(['C', '"/src/old.cs"', '""', '40', '41', 'F', GAME, '""', '""', '"0001-01-01T00:00:00.0000000"']);

    expect(diffEntriesIn(output).map((entry) => entry.date)).toEqual([undefined, undefined]);
  });

  it("dates a moved and changed item by its content change's revision", () => {
    const output =
      formatOutput(['C', '"/src/arith.ts"', '""', '55', '69', 'F', GAME, '""', '""', '"2026-11-20T09:15:02.0000000+01:00"']) +
      formatOutput(['M', '"/src/arith.ts"', '"/src/math.ts"', '-1', '50', 'F', GAME, '""', '""', '"2026-01-05T10:00:00.0000000+01:00"']);

    expect(diffEntriesIn(output)[0]?.date).toBe('2026-11-20T09:15:02.0000000+01:00');
  });

  it('reads a big diff in one pass: doubling it about doubles the work, sorting included', () => {
    const diffOf = (size: number) => formatOutput(...Array.from({ length: size }, (_, index) => ['C', `"/src/folder${index % 100}/file_${(index * 7919) % size}.ts"`, '""', '12', '13', 'F', GAME]));
    const charactersReadFor = (size: number) => countCharactersRead(() => diffEntriesIn(diffOf(size))).charactersRead;
    // About 2.2 (n·log n, the sort by path); a pass over the rest of the output per record reads 4 times as much.
    expect(charactersReadFor(4_000) / charactersReadFor(2_000)).toBeLessThan(2.5);
    expect(diffEntriesIn(diffOf(2_000))).toHaveLength(2_000);
  });
});
