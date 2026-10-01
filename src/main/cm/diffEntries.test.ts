import { describe, expect, it } from 'vitest';
import { countCharactersRead } from '@shared/testing/countCharactersRead';
import { parseDiffEntries } from './diffEntries';
import { formatOutput } from './testing/cmOutput';

const GAME = '"game@local"';

describe('parseDiffEntries', () => {
  it('reads added, changed and deleted items sorted by path', () => {
    const output =
      formatOutput(['A', '"/src/ui.ts"', '""', '-1', '36', 'F', GAME]) +
      formatOutput(['C', '"/assets/logo.png"', '""', '13', '37', 'B', GAME]) +
      formatOutput(['D', '"/docs/notes.md"', '""', '-1', '14', 'F', GAME]);

    expect(parseDiffEntries(output)).toEqual([
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

    expect(parseDiffEntries(output).map(({ path, itemType, baseRevisionId, revisionId, repository }) => ({ path, itemType, baseRevisionId, revisionId, repository }))).toEqual([
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
    expect(parseDiffEntries(output).map((entry) => entry.path)).toEqual(['File_1.txt', 'file_2.txt', 'file_10.txt', 'file_100.txt']);
  });

  it('shows the same revision on both sides of a pure move', () => {
    const [moved] = parseDiffEntries(formatOutput(['M', '"/docs/changelog.md"', '"/docs/notes.md"', '-1', '14', 'F', GAME]));
    expect(moved).toMatchObject({ status: 'moved', oldPath: 'docs/notes.md', baseRevisionId: 14, revisionId: 14 });
  });

  it('merges a moved and changed item into one entry', () => {
    const output = formatOutput(['C', '"/src/arith.ts"', '""', '55', '69', 'F', GAME]) + formatOutput(['M', '"/src/arith.ts"', '"/src/math.ts"', '-1', '69', 'F', GAME]);
    expect(parseDiffEntries(output)).toEqual([
      { status: 'moved', path: 'src/arith.ts', oldPath: 'src/math.ts', itemType: 'file', baseRevisionId: 55, revisionId: 69, repository: 'game@local' },
    ]);
  });

  it('reads a big diff in one pass: a few reads of each character, whatever the size', () => {
    const output = formatOutput(...Array.from({ length: 5_000 }, (_, index) => ['C', `"/src/folder${index % 100}/file_${(index * 7919) % 5_000}.ts"`, '""', '12', '13', 'F', GAME]));
    const { result: entries, charactersRead } = countCharactersRead(() => parseDiffEntries(output));
    // About 4.2 reads of each character; a pass over the rest of the output per record reads each thousands of times.
    expect(charactersRead / output.length).toBeLessThan(6);
    expect(entries).toHaveLength(5_000);
  });
});
