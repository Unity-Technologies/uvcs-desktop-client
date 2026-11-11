import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { compareWithHead, readHeadItem, readLoadedTreeItem, type HeadItem, type LoadedTreeItem } from './partialComparison';

// `cm ls -R --format={itemid}|{revid}|{parentrevid}|{type}|{wkpath}|{changeset}|{checkout}` in the workspace: what it
// has loaded. The sandbox's (`partial-operations.sh`): the root and Code, two files.
const loaded = (...records: string[]): LoadedTreeItem[] => records.map((record) => readLoadedTreeItem(record.split('|'))!);
// `cm ls / /Code --tree=br:/main --format={itemid}|{revid}|{type}|{path}|{changeset}`: each folder and its children.
const head = (...records: string[]): HeadItem[] => records.map((record) => readHeadItem(record.split('|'))!);

const SANDBOX_LOADED = loaded('3|5|-1|dir||0|', '22|23|-1|dir|Code|1|', '27|15|-1|txt|Code\\Engine.cs|1|', '28|16|-1|txt|Code\\Ship.cs|1|');
const SANDBOX_HEAD = head(
  '3|40|dir|/|3',
  '18|19|dir|/Art|1',
  '20|42|dir|/Audio|3',
  '22|41|dir|/Code|3',
  '22|41|dir|/Code|3',
  '27|15|txt|/Code/Engine.cs|1',
  '43|38|txt|/Code/Hull.cs|3',
  '28|34|txt|/Code/Ship.cs|2',
);

const item = (overrides: Partial<PartialIncomingItem> & Pick<PartialIncomingItem, 'kind' | 'path'>): PartialIncomingItem => ({
  isDirectory: false,
  conflict: false,
  loadedRevisionId: null,
  headRevisionId: null,
  ...overrides,
});

describe('a listed item', () => {
  it('reads a loaded item with the path as the app names it: forward slashes, composed accents', () => {
    // macOS lists names decomposed (NFD); `cm status` and the rest of the app name them composed.
    expect(readLoadedTreeItem(['28', '16', '-1', 'txt', 'Code\\Cafe\u0301.cs', '1', ''])).toEqual({
      itemId: 28,
      revisionId: 16,
      isDirectory: false,
      path: 'Code/Caf\u00e9.cs',
      changeset: 1,
    });
  });

  it('reads a checked-out file at the revision it was loaded from, which `cm` lists apart', () => {
    expect(readLoadedTreeItem(['27', '-1', '15', 'txt', 'Code/Engine.cs', '-1', 'CO'])).toEqual({
      itemId: 27,
      revisionId: 15,
      isDirectory: false,
      path: 'Code/Engine.cs',
      changeset: null,
    });
  });

  it('leaves out a private item, which has no revision', () => {
    expect(readLoadedTreeItem(['', '', '', 'txt', 'notes.txt', '', ''])).toBeUndefined();
  });

  it('reads a head item at its path in the workspace, the root as empty', () => {
    expect(readHeadItem(['43', '38', 'txt', '/Code/Hull.cs', '3'])).toEqual({ itemId: 43, revisionId: 38, isDirectory: false, path: 'Code/Hull.cs', changeset: 3 });
    expect(readHeadItem(['3', '40', 'dir', '/', '3'])?.path).toBe('');
  });
});

describe('what the branch head brings a partial workspace', () => {
  it('names the files changed and the new ones in its folders, not the folders it never loaded', () => {
    expect(compareWithHead(SANDBOX_LOADED, SANDBOX_HEAD, new Set())).toEqual([
      item({ kind: 'added', path: 'Code/Hull.cs', headRevisionId: 38 }),
      item({ kind: 'changed', path: 'Code/Ship.cs', loadedRevisionId: 16, headRevisionId: 34 }),
    ]);
  });

  it('marks a conflict where a file changed both locally and on the branch, not where it changed locally alone', () => {
    const changes = compareWithHead(SANDBOX_LOADED, SANDBOX_HEAD, new Set(['Code/Ship.cs', 'Code/Engine.cs']));
    expect(changes.filter((change) => change.conflict).map((change) => change.path)).toEqual(['Code/Ship.cs']);
  });

  it('compares a checked-out file by the revision it was loaded from', () => {
    const checkedOut = loaded('3|5|-1|dir||0|', '22|23|-1|dir|Code|1|', '28|-1|16|txt|Code/Ship.cs|-1|CO');
    expect(compareWithHead(checkedOut, SANDBOX_HEAD, new Set(['Code/Ship.cs']))).toContainEqual(
      item({ kind: 'changed', path: 'Code/Ship.cs', conflict: true, loadedRevisionId: 16, headRevisionId: 34 }),
    );
  });

  it("doesn't take a folder's revision for a change: an update leaves the loaded one as it was", () => {
    const folderOnly = head('3|40|dir|/|3', '22|41|dir|/Code|3', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1');
    expect(compareWithHead(SANDBOX_LOADED, folderOnly, new Set())).toEqual([]);
  });

  it('names a renamed or moved item with where it was, and a changed one moved as changed', () => {
    const moved = head('3|40|dir|/|3', '22|41|dir|/Code|3', '27|15|txt|/Code/Core.cs|1', '28|34|txt|/Ship.cs|2');
    expect(compareWithHead(SANDBOX_LOADED, moved, new Set())).toEqual([
      item({ kind: 'moved', path: 'Code/Core.cs', oldPath: 'Code/Engine.cs', loadedRevisionId: 15, headRevisionId: 15 }),
      item({ kind: 'changed', path: 'Ship.cs', oldPath: 'Code/Ship.cs', loadedRevisionId: 16, headRevisionId: 34 }),
    ]);
  });

  it('names a removed item, and a removed folder alone, not each item it held', () => {
    const withoutCode = head('3|40|dir|/|3');
    expect(compareWithHead(SANDBOX_LOADED, withoutCode, new Set())).toEqual([
      item({ kind: 'removed', path: 'Code', isDirectory: true, loadedRevisionId: 23 }),
    ]);
    const withoutShip = head('3|40|dir|/|3', '22|41|dir|/Code|3', '27|15|txt|/Code/Engine.cs|1');
    expect(compareWithHead(SANDBOX_LOADED, withoutShip, new Set(['Code/Ship.cs']))).toEqual([
      item({ kind: 'removed', path: 'Code/Ship.cs', conflict: true, loadedRevisionId: 16 }),
    ]);
  });

  it("doesn't take an older item the workspace left out for a new one, even in a changeset after the loaded ones", () => {
    // Audio (item 20) changed in changeset 3, after everything loaded, but existed before: the workspace left it out.
    const added = compareWithHead(SANDBOX_LOADED, SANDBOX_HEAD, new Set()).filter((change) => change.kind === 'added');
    expect(added.map((change) => change.path)).toEqual(['Code/Hull.cs']);
  });

  it('names a new folder as a folder', () => {
    const withFolder = head(...['3|40|dir|/|3', '22|41|dir|/Code|3', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1', '50|51|dir|/Code/AI|4']);
    expect(compareWithHead(SANDBOX_LOADED, withFolder, new Set())).toEqual([item({ kind: 'added', path: 'Code/AI', isDirectory: true, headRevisionId: 51 })]);
  });

  it('brings nothing when the head is what the workspace loaded', () => {
    const same = head('3|5|dir|/|0', '22|23|dir|/Code|1', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1');
    expect(compareWithHead(SANDBOX_LOADED, same, new Set(['Code/Engine.cs']))).toEqual([]);
  });
});
