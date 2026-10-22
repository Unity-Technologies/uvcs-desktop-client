import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { checkinPathsOf } from './checkinPaths';

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

    expect(checkinPathsOf([rootFile, xlink, inXlink], pending)).toEqual({ paths: ['app/Root.cs', 'devops/src/build/Build.cs'], addsPrivate: false, pulledIn: [] });
  });

  // cm takes along the checkout or the add of the folders above any path it is given.
  it('leaves out a checked-out or added folder holding checked files, as they take it along', () => {
    const checkedOut = folder('src', ['checkedOut']);
    const a = file('src/a.cs', ['checkedOut', 'changed']);
    const b = file('src/b.cs', ['changed']);
    const added = folder('assets', ['added']);
    const icon = file('assets/icon.png', ['added']);

    expect(checkinPathsOf([checkedOut, a, added, icon], [checkedOut, a, b, added, icon])).toEqual({ paths: ['src/a.cs', 'assets/icon.png'], addsPrivate: false, pulledIn: [] });
  });

  it('gives a checked-out folder checked alone, and says what inside it goes in too', () => {
    const checkedOut = folder('src', ['checkedOut']);
    const b = file('src/b.cs', ['changed']);

    expect(checkinPathsOf([checkedOut], [checkedOut, b])).toEqual({ paths: ['src'], addsPrivate: false, pulledIn: [b] });
  });

  // cm refuses a moved folder's files without it, and takes everything under it with it.
  it('gives a moved folder, and says which unchecked changes inside it go in too, private ones only with --private', () => {
    const moved = folder('lib', ['moved']);
    const b = file('lib/b.cs', ['changed']);
    const p = file('lib/p.txt', ['private']);

    expect(checkinPathsOf([moved], [moved, b, p])).toEqual({ paths: ['lib'], addsPrivate: false, pulledIn: [b] });
    expect(checkinPathsOf([moved, notes], [moved, b, p, notes])).toEqual({ paths: ['lib', 'notes.txt'], addsPrivate: true, pulledIn: [b, p] });
  });

  // cm refuses a private file without its private folder ("depend on others that need to be included").
  it('gives a private folder with its checked files, and says which unchecked ones go in too', () => {
    const extra = file('devops/tools/pub/pub-tests/U.cs', ['private']);

    expect(checkinPathsOf([privateFolder, privateFile], [privateFolder, privateFile, extra])).toEqual({
      paths: ['devops/tools/pub/pub-tests', 'devops/tools/pub/pub-tests/T.cs'],
      addsPrivate: true,
      pulledIn: [extra],
    });
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

    expect(checkinPathsOf([moved, inner], [moved, inner, deep])).toEqual({ paths: ['lib', 'lib/core'], addsPrivate: false, pulledIn: [deep] });
  });
});
