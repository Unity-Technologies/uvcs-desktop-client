import { describe, expect, it } from 'vitest';
import { FOUND_REVIEWS } from './codeReviewRecords';
import { parseItemDetails } from './itemDetailsXml';
import { lockReader } from './lockRecords';
import { listedRevisionId, readTreeItem, TREE_ITEMS } from './treeItems';
import { formatOutput, recordsIn, recordsOutput } from './testing/cmOutput';

/** Items of `cm ls --format=TREE_ITEM_FORMAT`, the fields as `cm` prints them. */
const listed = (...items: Partial<Record<(typeof TREE_ITEMS.fields)[number], string | number>>[]): string => recordsOutput(TREE_ITEMS, ...items);

describe('listedRevisionId', () => {
  it('tells an item with no revision (private, not loaded) from a checkout and a loaded revision', () => {
    expect([listedRevisionId(''), listedRevisionId('-1'), listedRevisionId('52')]).toEqual([undefined, -1, 52]);
  });
});

describe('readTreeItem', () => {
  const parseTreeItems = (output: string) => recordsIn(output, readTreeItem);

  it('skips the listed directory and maps each child', () => {
    const output = listed(
      { name: '.', wkpath: 'src', type: 'dir', size: 0, revid: 1 },
      { name: 'core', wkpath: 'src/core', size: 0, type: 'dir', changeset: 2, owner: 'jane@unity.com', revid: 52, parentrevid: 37, itemid: 36, branch: '/main', 'date:o': '2026-09-25T09:41:47.0000000+02:00' },
      // A private file: no revision, nor anything else but its size, type and date (`cm` prints the others empty).
      { name: 'notes.txt', wkpath: 'src\\notes.txt', size: 5, type: 'txt', 'date:o': '2026-09-25T09:00:00.0000000+02:00' },
      { name: 'logo.png', wkpath: '/src/logo.png', size: 120, type: 'bin', checkout: 'CO', changeset: -1, revid: -1, 'date:o': '0001-01-01T00:00:00.0000000' },
    );
    const items = parseTreeItems(output);
    expect(items.map((item) => item.path)).toEqual(['src/core', 'src/notes.txt', 'src/logo.png']);
    expect(items[0]).toMatchObject({ itemType: 'directory', changeset: 2, revisionId: 52, parentRevisionId: 37, isPrivate: false, date: '2026-09-25T09:41:47.0000000+02:00' });
    expect(items[1]).toMatchObject({ itemType: 'file', isPrivate: true, size: 5, revisionId: -1, changeset: -1, repository: '' });
    expect(items[2]).toMatchObject({ itemType: 'binaryFile', isCheckedOut: true, isPrivate: false, date: '' });
  });

  it('reads nothing from an empty listing', () => {
    expect(parseTreeItems('')).toEqual([]);
  });

  // `cm ls` prints nothing but the name and path of an item the workspace has but didn't load: no revision, as for a
  // private one, and no size either.
  it('tells an item not loaded from a private one', () => {
    const [notLoaded] = parseTreeItems(listed({ name: 'big.bin', wkpath: 'big.bin', type: 'not loaded' }));
    expect(notLoaded).toMatchObject({ isPrivate: false, revisionId: -1, size: 0 });
  });

  it("reads the hash of each item's revision: the one it was loaded from, even where the disk's file changed", () => {
    // A workspace whose a.txt was edited (the revision's hash and size, 4 bytes) and b.txt checked out (no revision, the disk's hash).
    const output = listed(
      { name: 'a.txt', wkpath: 'a.txt', size: 4, type: 'txt', changeset: 2, repspec: 'rep:probe@local', revid: 13, hash: 'W79aUjKOdDmubnGd/nEiAA==' },
      { name: 'b.txt', wkpath: 'b.txt', size: 4, type: 'txt', changeset: -1, repspec: 'rep:probe@local', checkout: 'CO', revid: -1, hash: 'wZNJehoGssciMOYUb/RwgA==' },
      { name: 'notes.txt', wkpath: 'notes.txt', size: 9, type: 'txt' },
    );
    expect(parseTreeItems(output).map((item) => [item.path, item.revisionId, item.hash])).toEqual([
      ['a.txt', 13, 'W79aUjKOdDmubnGd/nEiAA=='],
      ['b.txt', -1, 'wZNJehoGssciMOYUb/RwgA=='],
      ['notes.txt', -1, undefined],
    ]);
  });

  it("reads a shelve's revisions, which a workspace on a shelve lists as changeset -3 on branch id:-1", () => {
    const output = listed(
      { name: 'a.txt', wkpath: 'a.txt', size: 10, type: 'txt', changeset: -3, repspec: 'rep:uvcs-shelvews-sandbox@local', owner: 'jane.doe@example.com', revid: 24, parentrevid: 13, itemid: 15, branch: 'id:-1' },
      { name: 'priv.txt', wkpath: 'priv.txt', size: 2, type: 'txt' },
    );
    const [shelved, privateFile] = parseTreeItems(output);
    expect(shelved).toMatchObject({ changeset: null, shelveId: 3, branch: '', revisionId: 24, parentRevisionId: 13 });
    expect(privateFile).toMatchObject({ changeset: -1, isPrivate: true });
    expect(privateFile).not.toHaveProperty('shelveId');
  });

  it('reads symbolic links as links, with where they point', () => {
    const output = listed(
      { name: 'linkdir', wkpath: 'linkdir', size: 3, type: 'link', symlinktarget: ' -> src' },
      { name: 'main.ts', wkpath: 'main.ts', size: 10, type: 'txt', revid: 7 },
    );
    const [link, file] = parseTreeItems(output);
    expect(link).toMatchObject({ itemType: 'symlink', isPrivate: true, symlinkTarget: 'src' });
    expect(file).not.toHaveProperty('symlinkTarget');
  });

  it('reads the repository of each item: the xlinked one under an xlink, and for the xlink itself', () => {
    // `cm ls 01project/src/client/plugins` in acme@acme@cloud.
    const output = listed(
      { name: 'ci-81-plugin', wkpath: '01project/src/client/plugins/ci-81-plugin', type: 'dir', size: 0, repspec: 'rep:acme@acme@cloud', revid: 31045109 },
      { name: 'ci-plugin -> wxlink -> / 6696@plugins/ciplugin@ [relative] acme@cloud', wkpath: '01project/src/client/plugins/ci-plugin', type: 'dir', size: 0, repspec: 'rep:plugins/ciplugin@acme@cloud', revid: 278093 },
      {
        name: 'CreatePath.cs',
        wkpath: '01project/src/client/plugins/editor-plugin/Packages/com.acme.editor.tests/Infrastructure/CreatePath.cs',
        type: 'txt',
        size: 812,
        changeset: 8285,
        repspec: 'rep:editorGUI@acme@cloud',
        revid: 175536,
        parentrevid: -1,
        branch: '/main/task1004207',
      },
      { name: '.DS_Store', wkpath: '01project/src/client/plugins/.DS_Store', type: 'bin', size: 6148 },
    );
    expect(parseTreeItems(output).map(({ name, revisionId, repository }) => ({ name, revisionId, repository }))).toEqual([
      { name: 'ci-81-plugin', revisionId: 31045109, repository: 'acme@acme@cloud' },
      { name: 'ci-plugin', revisionId: 278093, repository: 'plugins/ciplugin@acme@cloud' },
      { name: 'CreatePath.cs', revisionId: 175536, repository: 'editorGUI@acme@cloud' },
      { name: '.DS_Store', revisionId: -1, repository: '' },
    ]);
  });

  it('names an xlink after its path and reads where it points', () => {
    const output = listed({ name: 'third -> wxlink -> / 17568@thirdparty@ [relative] acme@cloud', wkpath: 'libs/third', type: 'dir', size: 0, revid: 90 });
    expect(parseTreeItems(output)[0]).toMatchObject({
      name: 'third',
      itemType: 'directory',
      xlink: { writable: true, repository: 'thirdparty', changeset: 17568, path: '/' },
    });
  });

  it('keeps names as cm prints them: Unicode, and quotes a name starts and ends with', () => {
    const output = listed({ name: '"ñandú 日本".txt', wkpath: 'docs\\"ñandú 日本".txt', type: 'txt', size: 1, revid: 3 });
    expect(parseTreeItems(output)[0]).toMatchObject({ name: '"ñandú 日本".txt', path: 'docs/"ñandú 日本".txt' });
  });
});

describe('parseItemDetails', () => {
  it('reads the fileinfo fields', () => {
    const xml = `<FileInfos><FileInfo><ServerPath>/README.md</ServerPath><Status>controlled</Status>
      <RevisionChangeset>1</RevisionChangeset><RepSpec>repo@local</RepSpec><Changelist /></FileInfo></FileInfos>`;
    expect(parseItemDetails(xml)).toMatchObject({ serverPath: '/README.md', loadedChangeset: 1, repository: 'repo@local', changelist: '' });
  });
});

describe('lockReader', () => {
  it('parses the smart locks layout', () => {
    const line = ['repo', '41', 'guid-1', '2026-09-25T09:43:06+02:00', '/main', '19', '/main/task', '55', 'Retained', 'jane', 'wk', '/a.psd'];
    const [lock] = recordsIn(formatOutput(line), lockReader('local'));
    expect(lock).toEqual({
      repository: 'repo@local',
      itemId: 41,
      guid: 'guid-1',
      date: '2026-09-25T09:43:06+02:00',
      destinationBranch: '/main',
      holderBranch: '/main/task',
      status: 'Retained',
      owner: 'jane',
      workspace: 'wk',
      path: '/a.psd',
    });
  });
});

describe('code review records', () => {
  it('strips the status type name and splits the target', () => {
    const output = recordsOutput(
      FOUND_REVIEWS,
      { id: 60, title: 'Branch review', status: 'Status Rework required', targettype: 'Branch', target: 'id:54', assignee: '' },
      { id: 62, title: 'Changeset review', status: 'Status Reviewed', targettype: 'Changeset', target: 2 },
      { id: 63, title: 'Shelve review', status: 'Status Under review', targettype: 'Shelve', target: 3 },
    );
    expect(recordsIn(output, FOUND_REVIEWS)).toMatchObject([
      { id: 60, status: 'Rework required', targetType: 'branch', targetId: 54, assignee: '' },
      { id: 62, status: 'Reviewed', targetType: 'changeset', targetId: 2 },
      { id: 63, status: 'Under review', targetType: 'shelve', targetId: 3 },
    ]);
  });
});
