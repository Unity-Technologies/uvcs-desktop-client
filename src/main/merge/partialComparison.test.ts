import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { changedFoldersWithUnloadedItems, compareWithHead, readHeadItem, readLoadedTreeItem, repositorySpec, type HeadItem, type LoadedTreeItem } from './partialComparison';

// `cm ls -R --format={itemid}|{revid}|{parentrevid}|{type}|{wkpath}|{changeset}|{checkout}|{name}` in the workspace:
// what it has loaded. The sandbox's (`partial-operations.sh`): the root and Code, two files. `{name}` is left out where
// it only repeats the path's last part: it tells an xlink alone.
const loaded = (...records: string[]): LoadedTreeItem[] => records.map((record) => readLoadedTreeItem(record.split('|'))!);
// `cm ls / /Code --tree=br:/main --format={itemid}|{revid}|{type}|{path}|{changeset}|{name}`: each folder and its children.
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

  it('names a moved folder alone, and what it held only where it changed or moved on its own', () => {
    const codeMovedToSrc = head('3|40|dir|/|3', '22|41|dir|/Src|3', '22|41|dir|/Src|3', '27|15|txt|/Src/Core.cs|1', '28|34|txt|/Src/Ship.cs|2');
    expect(compareWithHead(SANDBOX_LOADED, codeMovedToSrc, new Set(['Code/Ship.cs']))).toEqual([
      item({ kind: 'moved', path: 'Src', oldPath: 'Code', isDirectory: true, loadedRevisionId: 23, headRevisionId: 41 }),
      item({ kind: 'moved', path: 'Src/Core.cs', oldPath: 'Code/Engine.cs', loadedRevisionId: 15, headRevisionId: 15 }),
      item({ kind: 'changed', path: 'Src/Ship.cs', conflict: true, loadedRevisionId: 16, headRevisionId: 34 }),
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

  it("doesn't take a new item for an added one in a folder the workspace loaded only in part", () => {
    // The root holds Art and Audio, which existed before what the workspace loaded and it left out: it loaded the root
    // in part, so Big, new on the head, is another item it leaves out. Code, loaded whole, still gets Hull.cs.
    const withBig = head(...['3|40|dir|/|3', '18|19|dir|/Art|1', '20|42|dir|/Audio|3', '60|61|dir|/Big|5', '22|41|dir|/Code|3'], '43|38|txt|/Code/Hull.cs|3');
    const added = compareWithHead(SANDBOX_LOADED, withBig, new Set()).filter((change) => change.kind === 'added');
    expect(added.map((change) => change.path)).toEqual(['Code/Hull.cs']);
  });

  it('names a new item in the root when the workspace loaded all of it', () => {
    const withNew = head('3|40|dir|/|3', '22|41|dir|/Code|3', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1', '60|61|txt|/README.md|5');
    expect(compareWithHead(SANDBOX_LOADED, withNew, new Set())).toEqual([item({ kind: 'added', path: 'README.md', headRevisionId: 61 })]);
  });

  it('names a new folder as a folder', () => {
    const withFolder = head(...['3|40|dir|/|3', '22|41|dir|/Code|3', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1', '50|51|dir|/Code/AI|4']);
    expect(compareWithHead(SANDBOX_LOADED, withFolder, new Set())).toEqual([item({ kind: 'added', path: 'Code/AI', isDirectory: true, headRevisionId: 51 })]);
  });

  describe('an item that looks new but existed when the folder was loaded', () => {
    // Big (item 60) was created after everything the workspace loaded, then the workspace loaded the root at a later
    // changeset and left Big out: by id and changeset it looks new, but the root's listing at its loaded changeset has it.
    const withBig = head('3|40|dir|/|5', '60|61|dir|/Big|5', '22|41|dir|/Code|3', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1', '70|71|txt|/README.md|6');
    // `cm ls / --tree=cs:0`: what the root held as the workspace loaded it.
    const rootWhenLoaded = new Map([['', head('60|61|dir|/Big|5', '22|23|dir|/Code|1')]]);

    it('is not added, and its folder counts as loaded in part, so nothing new in it is added', () => {
      expect(compareWithHead(SANDBOX_LOADED, withBig, new Set(), rootWhenLoaded)).toEqual([]);
    });

    it('leaves what is new in other folders added', () => {
      const withHull = [...withBig, ...head('43|38|txt|/Code/Hull.cs|3')];
      const added = compareWithHead(SANDBOX_LOADED, withHull, new Set(), rootWhenLoaded).filter((change) => change.kind === 'added');
      expect(added.map((change) => change.path)).toEqual(['Code/Hull.cs']);
    });

    it('is looked for only in the loaded folders the head changed that hold an item the workspace left out', () => {
      expect(changedFoldersWithUnloadedItems(SANDBOX_LOADED, withBig).map((folder) => folder.path)).toEqual(['']);
      expect(changedFoldersWithUnloadedItems(SANDBOX_LOADED, SANDBOX_HEAD).map((folder) => folder.path)).toEqual(['', 'Code']);
      expect(changedFoldersWithUnloadedItems(SANDBOX_LOADED, head('3|40|dir|/|3', '22|41|dir|/Code|3'))).toEqual([]);
    });

    it('is not looked for in a checked-out folder, which has no loaded changeset to list it at', () => {
      const checkedOut = loaded('3|-1|5|dir||-1|CO', '22|23|-1|dir|Code|1|', '27|15|-1|txt|Code\\Engine.cs|1|', '28|16|-1|txt|Code\\Ship.cs|1|');
      expect(changedFoldersWithUnloadedItems(checkedOut, withBig)).toEqual([]);
    });
  });

  it('marks a removed folder a conflict when something it held changed locally', () => {
    expect(compareWithHead(SANDBOX_LOADED, head('3|40|dir|/|3'), new Set(['Code/Ship.cs']))).toEqual([
      item({ kind: 'removed', path: 'Code', isDirectory: true, conflict: true, loadedRevisionId: 23 }),
    ]);
  });

  it("compares an xlink's items with its head, apart from the workspace's own, and names the repository they belong to", () => {
    // `cm ls` lists an xlink as a folder (`dir`) named after its target, holding the other repository's items: its
    // root is that repository's (item 3 here too) and its files reuse ids the workspace's repository gives others
    // (Math.cs is 27, as Engine.cs): ids are compared within one repository only.
    const withXlink = loaded(
      ...['3|5|-1|dir||0||.', '22|23|-1|dir|Code|1|', '27|15|-1|txt|Code\\Engine.cs|1|', '28|16|-1|txt|Code\\Ship.cs|1|'],
      '3|31|30|dir|Lib|9||Lib -> wxlink -> / 9@lib@ [relative] local',
      '27|33|-1|txt|Lib\\Math.cs|9|',
    );
    const headWithXlink = head(
      '3|40|dir|/|3|.',
      '22|41|dir|/Code|3',
      '27|15|txt|/Code/Engine.cs|1',
      '28|34|txt|/Code/Ship.cs|2',
      '3|35|dir|/Lib|12|Lib -> wxlink -> / 12@lib@ [relative] local',
      '27|36|txt|/Lib/Math.cs|12',
      '60|61|txt|/Lib/New.cs|12',
    );
    expect(compareWithHead(withXlink, headWithXlink, new Set())).toEqual([
      item({ kind: 'changed', path: 'Code/Ship.cs', loadedRevisionId: 16, headRevisionId: 34 }),
      item({ kind: 'changed', path: 'Lib/Math.cs', loadedRevisionId: 33, headRevisionId: 36, repository: 'lib@local' }),
      item({ kind: 'added', path: 'Lib/New.cs', headRevisionId: 61, repository: 'lib@local' }),
    ]);
  });

  it('names what the head brings into a folder of a partial workspace inside an xlink, as the official clients do', () => {
    // A partial workspace of a repository that xlinks another at 03pnunit, with accelerator loaded whole at cs:27890 of
    // the xlinked repository. On the head, five of its files changed, one was removed and one is new.
    const xlinked = '2|850279|849994|dir|03pnunit|27890||03pnunit -> wxlink -> / 27894@pnunit@ [relative] codice@cloud';
    const accelerator = '03pnunit\\test\\carnagetest\\accelerator';
    const loadedRows = loaded(
      '2|4|-1|dir||0|',
      xlinked,
      '101652|850280|-1|dir|03pnunit\\test|27890|',
      '103262|850281|-1|dir|03pnunit\\test\\carnagetest|27890|',
      `833552|850282|-1|dir|${accelerator}|27890|`,
      `833554|850035|-1|txt|${accelerator}\\AcceleratorTest.cs|27880|`,
      `838894|838899|-1|txt|${accelerator}\\CarnageMain.cs|27275|`,
      `833555|850036|-1|txt|${accelerator}\\EntryDownloader.cs|27880|`,
      `833556|850037|-1|txt|${accelerator}\\EntryUploader.cs|27880|`,
      `838963|845883|-1|txt|${accelerator}\\GetUnityToken.cs|27570|`,
      `834351|850038|-1|txt|${accelerator}\\LoadTest.cs|27880|`,
      `833905|834386|-1|txt|${accelerator}\\Stats.cs|27024|`,
      `833912|833907|-1|txt|${accelerator}\\VerifyChunk.cs|26997|`,
    );
    const onHead = '/03pnunit/test/carnagetest/accelerator';
    const headRows = head(
      '2|5000|dir|/|27898',
      '2|850312|dir|/03pnunit|27898|03pnunit -> wxlink -> / 27898@pnunit@ [relative] codice@cloud',
      '101652|850313|dir|/03pnunit/test|27898',
      '103262|850314|dir|/03pnunit/test/carnagetest|27898',
      `833552|850315|dir|${onHead}|27898`,
      `833554|850288|txt|${onHead}/AcceleratorTest.cs|27892`,
      `838894|849822|txt|${onHead}/CarnageMain.cs|27855`,
      `833555|850289|txt|${onHead}/EntryDownloader.cs|27892`,
      `833556|850037|txt|${onHead}/EntryUploader.cs|27880`,
      `834351|850290|txt|${onHead}/LoadTest.cs|27892`,
      `849844|850274|txt|${onHead}/SetEvictionConfig.cs|27889`,
      `833905|849839|txt|${onHead}/Stats.cs|27857`,
      `833912|833907|txt|${onHead}/VerifyChunk.cs|26997`,
    );
    // `cm ls /test/carnagetest/accelerator --tree=cs:27890@pnunit@codice@cloud`, read back at workspace paths.
    const acceleratorWhenLoaded = head(
      `833554|850035|txt|${onHead}/AcceleratorTest.cs|27880`,
      `838894|838899|txt|${onHead}/CarnageMain.cs|27275`,
      `833555|850036|txt|${onHead}/EntryDownloader.cs|27880`,
      `833556|850037|txt|${onHead}/EntryUploader.cs|27880`,
      `838963|845883|txt|${onHead}/GetUnityToken.cs|27570`,
      `834351|850038|txt|${onHead}/LoadTest.cs|27880`,
      `833905|834386|txt|${onHead}/Stats.cs|27024`,
      `833912|833907|txt|${onHead}/VerifyChunk.cs|26997`,
    );
    const folder = '03pnunit/test/carnagetest/accelerator';
    const repository = 'pnunit@codice@cloud';

    expect(changedFoldersWithUnloadedItems(loadedRows, headRows).map((each) => each.path)).toEqual([folder]);
    expect(compareWithHead(loadedRows, headRows, new Set(), new Map([[folder, acceleratorWhenLoaded]]))).toEqual([
      item({ kind: 'changed', path: `${folder}/AcceleratorTest.cs`, loadedRevisionId: 850035, headRevisionId: 850288, repository }),
      item({ kind: 'changed', path: `${folder}/CarnageMain.cs`, loadedRevisionId: 838899, headRevisionId: 849822, repository }),
      item({ kind: 'changed', path: `${folder}/EntryDownloader.cs`, loadedRevisionId: 850036, headRevisionId: 850289, repository }),
      item({ kind: 'removed', path: `${folder}/GetUnityToken.cs`, loadedRevisionId: 845883, repository }),
      item({ kind: 'changed', path: `${folder}/LoadTest.cs`, loadedRevisionId: 850038, headRevisionId: 850290, repository }),
      item({ kind: 'added', path: `${folder}/SetEvictionConfig.cs`, headRevisionId: 850274, repository }),
      item({ kind: 'changed', path: `${folder}/Stats.cs`, loadedRevisionId: 834386, headRevisionId: 849839, repository }),
    ]);
  });

  it('reads an xlink as `cm ls` lists it: a folder named after its target, read-only or writable', () => {
    expect(readLoadedTreeItem(['2', '850279', '849994', 'dir', '03pnunit', '27890', '', '03pnunit -> wxlink -> / 27894@pnunit@ [relative] codice@cloud'])?.xlink).toMatchObject({
      writable: true,
      repository: 'pnunit',
      server: 'codice@cloud',
    });
    expect(readHeadItem(['2', '446043', 'dir', '/04licensetools', '6782', '04licensetools -> xlink -> / 7649@licensetools@acme@cloud'])?.xlink).toMatchObject({
      writable: false,
      repository: 'licensetools',
      server: 'acme@cloud',
    });
    expect(readHeadItem(['22', '41', 'dir', '/Code', '3', 'Code'])?.xlink).toBeUndefined();
  });

  it("names an xlink's repository with its server, or alone when the xlink names none", () => {
    expect(repositorySpec({ writable: true, path: '/', changeset: 9, repository: 'lib', server: 'local' })).toBe('lib@local');
    expect(repositorySpec({ writable: true, path: '/', changeset: 9, repository: 'lib', server: '' })).toBe('lib');
  });

  it('does work in step with the workspace, however many local changes, removed folders and xlinks it holds', () => {
    // Doubling the workspace doubles the checks of whether a path lies under another, instead of quadrupling them:
    // a workspace of hundreds of thousands of items would otherwise take minutes.
    expect(pathChecksFor(2_000) / pathChecksFor(1_000)).toBeLessThan(2.5);
  });

  it('brings nothing when the head is what the workspace loaded', () => {
    const same = head('3|5|dir|/|0', '22|23|dir|/Code|1', '27|15|txt|/Code/Engine.cs|1', '28|16|txt|/Code/Ship.cs|1');
    expect(compareWithHead(SANDBOX_LOADED, same, new Set(['Code/Engine.cs']))).toEqual([]);
  });
});

/**
 * How many prefix and set checks comparing a workspace of `size` folders takes: one file in each, a tenth of the folders
 * removed on the head and changed locally, a tenth of the files changed on both sides, and a tenth as many xlinks.
 */
function pathChecksFor(size: number): number {
  const loadedItems: LoadedTreeItem[] = [{ itemId: 1, revisionId: 1, isDirectory: true, path: '', changeset: 1 }];
  const headItems: HeadItem[] = [{ itemId: 1, revisionId: 1, isDirectory: true, path: '', changeset: 1 }];
  const locallyChanged = new Set<string>();
  for (let index = 0; index < size; index++) {
    const folder = { itemId: 10 + 2 * index, revisionId: 1, isDirectory: true, path: `F${index}`, changeset: 1 };
    const file = { itemId: 11 + 2 * index, revisionId: 1, isDirectory: false, path: `F${index}/a.cs`, changeset: 1 };
    loadedItems.push(folder, file);
    if (index % 10 === 0) locallyChanged.add(file.path);
    else headItems.push(folder, index % 10 === 1 ? { ...file, revisionId: 2 } : file);
    if (index % 10 === 1) locallyChanged.add(file.path);
    if (index % 10 === 2) loadedItems.push({ itemId: 10 * size + index, revisionId: 1, isDirectory: true, path: `X${index}`, changeset: 1, xlink: { writable: true, path: '/', changeset: 1, repository: 'lib', server: 'local' } });
  }
  let checks = 0;
  const prefixChecks = countCalls(String.prototype, 'startsWith', () => {
    checks = countCalls(Set.prototype, 'has', () => compareWithHead(loadedItems, headItems, locallyChanged)).calls;
  }).calls;
  return checks + prefixChecks;
}
