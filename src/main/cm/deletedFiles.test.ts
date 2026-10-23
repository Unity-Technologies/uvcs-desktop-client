import { describe, expect, it } from 'vitest';
import { recordsOutput } from './testing/cmOutput';
import { deletedFilesArgs, notFoundPaths, parseDeletedFiles, pathsNotFound } from './deletedFiles';
import { TREE_ITEM_FORMAT, TREE_ITEMS } from './treeItems';

/** A record of `cm ls` in a workspace, as it prints one: the path relative to it, in the OS's separators. */
const listed = (wkpath: string, type: string, size: number, revid: number, repspec = 'rep:game@local') =>
  ({ name: wkpath.split(/[\\/]/).pop()!, wkpath, type, size, revid, repspec, changeset: 3, itemid: revid + 100, branch: '/main' }) as const;

describe('the deleted files listed', () => {
  it('lists every deleted file with one cm ls of their paths', () => {
    expect(deletedFilesArgs(['C:\\wk\\a.cs', 'C:\\wk\\art\\b.png'])).toEqual(['ls', 'C:\\wk\\a.cs', 'C:\\wk\\art\\b.png', TREE_ITEM_FORMAT]);
  });

  it("reads each one's revision and repository, and cm's kind and size of it, by its workspace path", () => {
    const output = recordsOutput(TREE_ITEMS, listed('src\\Player.cs', 'txt', 9184, 18), listed('art/Hero.png', 'bin', 20000, 14), listed('lib\\Util.cs', 'txt', 40, 7, 'rep:lib@local'));

    expect(Object.fromEntries(parseDeletedFiles(output))).toEqual({
      'src/Player.cs': { revision: { revisionId: 18, repository: 'game@local' }, isBinary: false, size: 9184 },
      'art/Hero.png': { revision: { revisionId: 14, repository: 'game@local' }, isBinary: true, size: 20000 },
      'lib/Util.cs': { revision: { revisionId: 7, repository: 'lib@local' }, isBinary: false, size: 40 },
    });
  });

  it('keys a decomposed name, as macOS prints it, by its composed form', () => {
    const output = recordsOutput(TREE_ITEMS, listed('Plie\u0301.cs', 'txt', 10, 5));

    expect([...parseDeletedFiles(output).keys()]).toEqual(['Pli\u00e9.cs']);
  });

  it('leaves out folders and items with no loaded revision', () => {
    const output = recordsOutput(TREE_ITEMS, listed('src', 'dir', 0, 4), { ...listed('new.cs', 'txt', 10, 0), revid: '' });

    expect(parseDeletedFiles(output).size).toBe(0);
  });
});

describe('the paths cm ls could not find', () => {
  it('reads each one it names, as printed', () => {
    const old2 = String.raw`c:\wk\src\Archive\Old2.cs`;
    const old3 = String.raw`c:\wk\src\Archive\Old3.cs`;
    const output = `Item ${old2} not found.\r\nItem ${old3} not found.\n${String.raw`src\Legacy\A.cs`}\u001ftxt`;

    expect(notFoundPaths(output)).toEqual([old2, old3]);
  });

  it('reads none from another failure', () => {
    expect(notFoundPaths('Error: the server is unreachable')).toEqual([]);
  });
});

describe('the asked paths cm ls named as not found', () => {
  const failure = (...printed: string[]) => printed.map((path) => `Item ${path} not found.`).join('\n');

  it("matches cm's Windows spelling: the drive in lower case, backslashes, any case", () => {
    const output = failure(String.raw`c:\Users\ana\wk\src\Archive\Old2.cs`);

    expect([...pathsNotFound(['src/Archive/Old2.cs', 'src/Legacy/A.cs'], output, 'win32')]).toEqual(['src/Archive/Old2.cs']);
    expect([...pathsNotFound(['SRC/archive/old2.cs'], output, 'win32')]).toEqual(['SRC/archive/old2.cs']);
  });

  it("matches cm's macOS spelling, the workspace's real path and decomposed names, case kept", () => {
    const output = failure('/private/tmp/wk/src/Archive/Plie\u0301.cs');

    expect([...pathsNotFound(['src/Archive/Pli\u00e9.cs', 'src/archive/Pli\u00e9.cs'], output, 'darwin')]).toEqual(['src/Archive/Pli\u00e9.cs']);
  });

  it('matches a whole name only, never the end of another', () => {
    expect([...pathsNotFound(['Old2.cs'], failure('/wk/src/XOld2.cs'), 'linux')]).toEqual([]);
    expect([...pathsNotFound(['Old2.cs'], failure('/wk/Old2.cs'), 'linux')]).toEqual(['Old2.cs']);
  });

  it('names none from another failure', () => {
    expect(pathsNotFound(['a.cs'], 'Error: the server is unreachable', 'linux').size).toBe(0);
  });
});
