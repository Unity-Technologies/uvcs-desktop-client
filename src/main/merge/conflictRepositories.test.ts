import { describe, expect, it } from 'vitest';
import type { FileConflict } from '@shared/domain/merge';
import type { PrintedMergePlan } from '../cm/mergeOutput';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { recordsIn, recordsOutput } from '../cm/testing/cmOutput';
import { readTreeItem, TREE_ITEM_FORMAT, TREE_ITEMS } from '../cm/treeItems';

const treeItemsIn = (output: string) => recordsIn(output, readTreeItem);
import { conflictListingArgs, destinationTree, withConflictRepositories, withRepositories } from './conflictRepositories';

const XLINKED = '/01project/src/client/plugins/editor-plugin/Packages/com.acme.editor.tests/Infrastructure/DiffWindowMockExtensions.cs';
const OWN = '/01project/src/client/cm/commands/merge/MergePrinter.cs';
const TEXTURE = '/01project/Assets/Textures/Grass.png';

const plan = (paths: string[]): PrintedMergePlan => ({
  status: 'ready',
  contributors: { source: { changesetId: 278738, branch: '/main/task1008583' }, destination: { changesetId: 278648, branch: '/main' } },
  changes: [],
  fileConflicts: paths.map((path) => ({ path, itemId: 425954, baseChangeset: 16828, sourceChangeset: 17092, destinationChangeset: 16973 })),
  directoryConflicts: [],
  warnings: [],
});

// `cm ls <paths> --tree=cs:278738 --format=TREE_ITEM_FORMAT` in acme@acme@cloud, where editor-plugin is an xlink to editorGUI.
const LISTING = recordsOutput(
  TREE_ITEMS,
  { name: 'DiffWindowMockExtensions.cs', wkpath: XLINKED, type: 'txt', size: 812, changeset: 17092, repspec: 'rep:editorGUI@acme@cloud', revid: 432251, itemid: 425954 },
  { name: 'MergePrinter.cs', wkpath: OWN, type: 'txt', size: 4211, changeset: 276520, repspec: 'rep:acme@acme@cloud', revid: 31259533, itemid: 420525 },
  { name: 'Grass.png', wkpath: TEXTURE, type: 'bin', size: 30889126, changeset: 276611, repspec: 'rep:acme@acme@cloud', revid: 31259610, itemid: 420530 },
);

describe('destinationTree', () => {
  it('is the destination contributor, else the branch merged into, else the workspace tells', () => {
    const withoutContributors = { ...plan([OWN]), contributors: undefined };
    expect(destinationTree({ kind: 'merge', sourceSpec: 'br:/main/task1008583' }, plan([OWN]))).toBe('cs:278648');
    expect(destinationTree({ kind: 'merge', sourceSpec: 'cs:5', destinationBranch: '/main' }, withoutContributors)).toBe('br:/main');
    expect(destinationTree({ kind: 'merge', sourceSpec: 'cs:5' }, withoutContributors)).toBeNull();
  });
});

describe('conflictListingArgs', () => {
  it('lists the conflicting files in the tree the merge goes into', () => {
    expect(conflictListingArgs(plan([XLINKED, OWN]), 'cs:278648')).toEqual(['ls', XLINKED, OWN, '--tree=cs:278648', TREE_ITEM_FORMAT]);
  });
});

describe('withRepositories', () => {
  it("names the xlinked repository of a file under a writable xlink, and the merged one's for the others, with the destination's revision there", () => {
    expect(withRepositories(plan([XLINKED, OWN]), treeItemsIn(LISTING)).fileConflicts.map(({ path, repository, destinationRevisionId }) => ({ path, repository, destinationRevisionId }))).toEqual([
      { path: XLINKED, repository: 'editorGUI@acme@cloud', destinationRevisionId: 432251 },
      { path: OWN, repository: 'acme@acme@cloud', destinationRevisionId: 31259533 },
    ]);
  });

  it("tells a binary by the type cm keeps for the destination's revision, with no byte of it read", () => {
    expect(withRepositories(plan([OWN, TEXTURE]), treeItemsIn(LISTING)).fileConflicts.map(({ path, destinationIsBinary }) => ({ path, destinationIsBinary }))).toEqual([
      { path: OWN, destinationIsBinary: false },
      { path: TEXTURE, destinationIsBinary: true },
    ]);
  });

  it('fails rather than read a conflicting file in a repository it may not be in', () => {
    expect(() => withRepositories(plan([XLINKED, '/elsewhere.cs']), treeItemsIn(LISTING))).toThrow('/elsewhere.cs');
  });

  it("fails rather than read a destination's version the listing names no revision of", () => {
    const withoutRevision = treeItemsIn(LISTING).map((item) => (item.path === OWN.slice(1) ? { ...item, revisionId: -1 } : item));
    expect(() => withRepositories(plan([XLINKED, OWN]), withoutRevision)).toThrow(`Couldn't tell which version of ${OWN} the destination has.`);
  });

  it('keeps a plan without file conflicts as it is', () => {
    expect(withRepositories(plan([]), []).fileConflicts).toEqual([]);
  });
});

describe('withConflictRepositories after a directory decision', () => {
  const MOVED = '/01project/maps/MergePrinter.cs';
  const completed: FileConflict = { path: OWN, destinationPath: OWN, itemId: 425954, baseChangeset: 16828, sourceChangeset: 17092, destinationChangeset: 16973, repository: 'acme@acme@cloud', destinationRevisionId: 31259533, destinationIsBinary: false };

  it('takes a file conflict completed before at the path the decision moved it to, listing only the others', async () => {
    const { cm, lines } = fakeCmClient({ ls: recordsOutput(TREE_ITEMS, { name: 'Grass.png', wkpath: TEXTURE, type: 'bin', size: 1, changeset: 1, repspec: 'rep:acme@acme@cloud', revid: 31259610, itemid: 420530 }) });
    const moved = plan([MOVED, TEXTURE]);
    moved.fileConflicts[1] = { ...moved.fileConflicts[1]!, itemId: 420530 };

    const completedPlan = await withConflictRepositories(cm, '/work', { kind: 'merge', sourceSpec: 'br:/main/task1008583' }, moved, undefined, [completed]);

    expect(completedPlan.fileConflicts).toEqual([
      { ...completed, path: MOVED },
      expect.objectContaining({ path: TEXTURE, destinationRevisionId: 31259610, destinationIsBinary: true }),
    ]);
    expect(lines()).toEqual([conflictListingArgs({ ...moved, fileConflicts: [moved.fileConflicts[1]!] }, 'cs:278648').join(' ')]);
  });

  it("reads by its item a file conflict the decision revealed at a path the destination's tree doesn't hold", async () => {
    // Moved by the destination into a folder added on both sides, it's revealed where the source has it once the
    // incoming folder is kept: `cm ls` of that path in the destination's tree fails.
    const { cm } = fakeCmClient({ ls: cmFails("Can't resolve the selector for the item /01project/Enemy.cs") });
    const revealed = { ...plan(['/01project/Enemy.cs']), repository: 'acme@acme@cloud' };

    const completedPlan = await withConflictRepositories(cm, '/work', { kind: 'merge', sourceSpec: 'br:/main/task1008583' }, revealed, undefined, [completed]);

    expect(completedPlan.fileConflicts).toEqual([
      { ...revealed.fileConflicts[0], destinationPath: '/01project/Enemy.cs', repository: 'acme@acme@cloud', destinationIsBinary: false },
    ]);
  });

  it('fails as cm does when listing a conflicting file fails before any decision', async () => {
    const { cm } = fakeCmClient({ ls: cmFails("Can't resolve the selector for the item /01project/Enemy.cs") });

    await expect(
      withConflictRepositories(cm, '/work', { kind: 'merge', sourceSpec: 'br:/main/task1008583' }, { ...plan(['/01project/Enemy.cs']), repository: 'acme@acme@cloud' }),
    ).rejects.toThrow("Can't resolve the selector");
  });

  it('lists nothing when every file conflict was completed before', async () => {
    const { cm, commands } = fakeCmClient();

    await withConflictRepositories(cm, '/work', { kind: 'merge', sourceSpec: 'br:/main/task1008583' }, plan([MOVED]), undefined, [completed]);

    expect(commands).toEqual([]);
  });
});
