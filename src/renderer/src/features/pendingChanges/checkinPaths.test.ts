import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { countCalls } from '@shared/testing/countCalls';
import { checkinPathsOf } from './checkinPaths';

const none = { pulledIn: [], pullingFolders: [] };

const file = (path: string, kinds: PendingChange['kinds']): PendingChange => ({ path, kinds, itemType: 'file', size: 1, lastModified: '' });
const folder = (path: string, kinds: PendingChange['kinds']): PendingChange => ({ path, kinds, itemType: 'directory', size: 0, lastModified: '' });

// `cm checkin` and `cm shelveset create` take everything under each path they are given, as cm status lists it.
describe('checkinPathsOf', () => {
  // A checkout inside a writable xlink checks the xlink out: cm status lists it as a checked-out folder.
  const xlink = folder('devops', ['checkedOut']);
  const inXlink = file('devops/src/build/Build.cs', ['checkedOut', 'changed']);
  const rootFile = file('app/Root.cs', ['changed']);
  const privateFolder = folder('devops/tools/pub/pub-tests', ['private']);
  const privateFile = file('devops/tools/pub/pub-tests/T.cs', ['private']);
  const notes = file('notes.txt', ['private']);

  it("leaves out a checked-out xlink holding checked files, so private items it holds don't go in", () => {
    const pending = [rootFile, xlink, inXlink, privateFolder, privateFile, notes];

    expect(checkinPathsOf([rootFile, xlink, inXlink], pending)).toEqual({ paths: ['app/Root.cs', 'devops/src/build/Build.cs'], addsPrivate: false, ...none });
  });

  // cm takes along the checkout of the folders above any path it is given, and with `--dependencies` their add.
  it('leaves out a checked-out, added or private folder holding checked files, as they take it along', () => {
    const checkedOut = folder('src', ['checkedOut']);
    const a = file('src/a.cs', ['checkedOut', 'changed']);
    const b = file('src/b.cs', ['changed']);
    const added = folder('assets', ['added']);
    const icon = file('assets/icon.png', ['added']);

    const inner = folder('src/ui', ['checkedOut']);
    const deep = file('src/ui/menu.cs', ['changed']);

    expect(checkinPathsOf([checkedOut, a, added, icon, inner, deep], [checkedOut, a, b, added, icon, inner, deep])).toEqual({
      paths: ['src/a.cs', 'assets', 'src/ui/menu.cs'],
      addsPrivate: false,
      ...none,
    });
    const extra = file('devops/tools/pub/pub-tests/U.cs', ['private']);
    expect(checkinPathsOf([privateFolder, privateFile], [privateFolder, privateFile, extra])).toEqual({ paths: ['devops/tools/pub/pub-tests/T.cs'], addsPrivate: true, ...none });
  });

  // A new project added whole: one path, not one per file, however many files it holds.
  it('gives a private, added or moved folder alone when everything in it is checked', () => {
    const project = folder('NewGame', ['private']);
    const inside = [folder('NewGame/Assets', ['private']), file('NewGame/Assets/Hero.prefab', ['private']), file('NewGame/README.md', ['private'])];
    const moved = folder('lib', ['moved']);
    const movedFile = file('lib/b.cs', ['changed']);

    expect(checkinPathsOf([project, ...inside, moved, movedFile], [project, ...inside, moved, movedFile, notes])).toEqual({ paths: ['NewGame', 'lib'], addsPrivate: true, ...none });
  });

  // Given, a checked-out folder (an xlink) takes what it holds: its files are given instead, as in the xlink case above.
  it('never gives a checked-out folder alone for what it holds, even all checked', () => {
    const checkedOut = folder('src', ['checkedOut']);
    const a = file('src/a.cs', ['changed']);

    expect(checkinPathsOf([checkedOut, a], [checkedOut, a]).paths).toEqual(['src/a.cs']);
  });

  // Unchecking a file in an added folder leaves the folder checked: given, it takes the file.
  it('gives an added folder checked without its files, and says which go in too', () => {
    const assets = folder('assets', ['added']);
    const icon = file('assets/icon.png', ['added']);

    expect(checkinPathsOf([assets], [assets, icon])).toEqual({ paths: ['assets'], addsPrivate: false, pulledIn: [icon], pullingFolders: ['assets'] });
  });

  it('gives a checked-out folder checked alone, and says what inside it goes in too', () => {
    const checkedOut = folder('src', ['checkedOut']);
    const b = file('src/b.cs', ['changed']);

    expect(checkinPathsOf([checkedOut], [checkedOut, b])).toEqual({ paths: ['src'], addsPrivate: false, pulledIn: [b], pullingFolders: ['src'] });
  });

  // cm refuses a moved folder's files without it, and takes everything under it with it.
  it('gives a moved folder, and says which unchecked changes inside it go in too, private ones only with --private', () => {
    const moved = folder('lib', ['moved']);
    const b = file('lib/b.cs', ['changed']);
    const p = file('lib/p.txt', ['private']);

    expect(checkinPathsOf([moved], [moved, b, p])).toEqual({ paths: ['lib'], addsPrivate: false, pulledIn: [b], pullingFolders: ['lib'] });
    expect(checkinPathsOf([moved, notes], [moved, b, p, notes])).toEqual({ paths: ['lib', 'notes.txt'], addsPrivate: true, pulledIn: [b, p], pullingFolders: ['lib'] });
  });

  it('gives a deleted, locally moved, or checked-out and moved folder: cm takes none of them along', () => {
    const gone = folder('old', ['deleted']);
    const movedHere = folder('tools', ['locallyMoved']);
    const both = folder('lib', ['checkedOut', 'moved']);
    const inBoth = file('lib/a.cs', ['changed']);

    expect(checkinPathsOf([gone, movedHere, both, inBoth], [gone, movedHere, both, inBoth])).toEqual({ paths: ['old', 'tools', 'lib'], addsPrivate: false, ...none });
  });

  it('names the outermost folders that take changes along, once each', () => {
    const lib = folder('lib', ['moved']);
    const core = folder('lib/core', ['moved']);
    const src = folder('src', ['moved']);
    const pulled = [file('lib/core/a.cs', ['changed']), file('lib/b.cs', ['changed']), file('src/c.cs', ['changed'])];

    expect(checkinPathsOf([lib, core, src], [lib, core, src, ...pulled]).pullingFolders).toEqual(['lib', 'src']);
  });

  // 20,000 checked files and a folder taking along 20,000 more: one pass, looking up only the folders above each.
  it('works it out on a big check-in looking up only the folders above each change', () => {
    const moved = folder('lib', ['moved']);
    const pulled = Array.from({ length: 20_000 }, (_, at) => file(`lib/level${at % 50}/item${at}.cs`, ['changed']));
    const checked = Array.from({ length: 20_000 }, (_, at) => file(`app/level${at % 50}/item${at}.cs`, ['changed']));

    const lookups = (method: 'has' | 'get') => {
      let calls = 0;
      const sets = countCalls(Set.prototype, 'has', () => {
        const maps = countCalls(Map.prototype, method, () => checkinPathsOf([moved, ...checked], [moved, ...checked, ...pulled]));
        calls += maps.calls;
        return maps.result;
      });
      return { result: sets.result, calls: calls + sets.calls };
    };

    expect(lookups('has').result.pulledIn).toHaveLength(20_000);
    expect(lookups('has').calls).toBeLessThanOrEqual(40_001 * 8);
    expect(lookups('get').calls).toBeLessThanOrEqual(40_001 * 8);
  });

  it('never says that ignored, cloaked or hidden changes inside a folder go in: cm leaves them out', () => {
    const moved = folder('lib', ['moved']);
    const ignored = file('lib/bin/out.dll', ['ignored']);
    const cloaked = file('lib/big.psd', ['cloaked']);
    const hidden = file('lib/local.cfg', ['hiddenChanged']);

    expect(checkinPathsOf([moved], [moved, ignored, cloaked, hidden]).pulledIn).toEqual([]);
  });

  it('tells a folder from a sibling whose name starts the same', () => {
    const moved = folder('src', ['moved']);
    const sibling = file('src2/a.cs', ['changed']);

    expect(checkinPathsOf([moved], [moved, sibling]).pulledIn).toEqual([]);
  });

  it('says what goes in under a folder inside a moved one, once', () => {
    const moved = folder('lib', ['moved']);
    const inner = folder('lib/core', ['checkedOut']);
    const deep = file('lib/core/c.cs', ['changed']);

    expect(checkinPathsOf([moved, inner], [moved, inner, deep])).toEqual({ paths: ['lib', 'lib/core'], addsPrivate: false, pulledIn: [deep], pullingFolders: ['lib'] });
  });
});
