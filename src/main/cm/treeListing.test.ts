import { describe, expect, it } from 'vitest';
import { formatOutput, treeListingOutput } from './testing/cmOutput';
import { parseTreeListing, treeListingArgs } from './treeListing';

describe('treeListingArgs', () => {
  it('lists a folder and everything below it at a point, or its children alone, the root as /', () => {
    expect(treeListingArgs('Game/Assets', 'cs:12', true).slice(0, 4)).toEqual(['ls', '/Game/Assets', '--tree=cs:12', '-R']);
    expect(treeListingArgs('Game/Assets', 'cs:12', false).slice(0, 3)).toEqual(['ls', '/Game/Assets', '--tree=cs:12']);
    expect(treeListingArgs('Game/Assets', 'cs:12', false)).not.toContain('-R');
    expect(treeListingArgs('', 'br:/main/task', true)[1]).toBe('/');
  });
});

describe('parseTreeListing', () => {
  it('reads each item with its revision in the repository holding it, its hash and the revision before it', () => {
    const output = treeListingOutput(
      { path: 'Art', type: 'dir', revid: 3 },
      { path: 'Art/bark.png', size: 8714025, revid: 29682, hash: 'gIxTMls7W/6uGzXpdYIprQ==', changeset: 251, parentrevid: 29001 },
      { path: 'Art/lib', type: 'xlink', revid: 9 },
      { path: 'Art/lib/leaf.png', revid: 4, repository: 'shared@acme@cloud' },
    );
    expect(parseTreeListing(output)).toEqual([
      { path: 'Art', isFolder: true, size: 0, revision: { revisionId: 3, repository: 'eco@local' }, hash: 'hash3==', changeset: 1, parentRevisionId: -1 },
      { path: 'Art/bark.png', isFolder: false, size: 8714025, revision: { revisionId: 29682, repository: 'eco@local' }, hash: 'gIxTMls7W/6uGzXpdYIprQ==', changeset: 251, parentRevisionId: 29001 },
      { path: 'Art/lib', isFolder: true, size: 0, revision: { revisionId: 9, repository: 'eco@local' }, hash: 'hash9==', changeset: 1, parentRevisionId: -1 },
      { path: 'Art/lib/leaf.png', isFolder: false, size: 0, revision: { revisionId: 4, repository: 'shared@acme@cloud' }, hash: 'hash4==', changeset: 1, parentRevisionId: -1 },
    ]);
  });

  it('reads Windows paths, the root, Unicode and CRLF records; skips an item without a revision', () => {
    const output = formatOutput(['\\', 'dir', 0, 1, 'h==', 'rep:eco@local', 1, -1], ['\\Árbol\\corteza.png', 'bin', 5, 2, 'h==', 'rep:eco@local', 1, -1], ['/private.png', 'bin', 5, -1, '', '', -1, -1]).replaceAll('\n', '\r\n');
    expect(parseTreeListing(output).map((item) => item.path)).toEqual(['', 'Árbol/corteza.png']);
  });
});
