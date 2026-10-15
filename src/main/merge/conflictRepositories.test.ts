import { describe, expect, it } from 'vitest';
import type { PrintedMergePlan } from '../cm/mergeOutput';
import { parseTreeItems } from '../cm/treeItemsXml';
import { conflictListingArgs, destinationTree, withRepositories } from './conflictRepositories';

const XLINKED = '/01project/src/client/plugins/editor-plugin/Packages/com.acme.editor.tests/Infrastructure/DiffWindowMockExtensions.cs';
const OWN = '/01project/src/client/cm/commands/merge/MergePrinter.cs';

const plan = (paths: string[]): PrintedMergePlan => ({
  status: 'ready',
  contributors: { source: { changesetId: 278738, branch: '/main/task1008583' }, destination: { changesetId: 278648, branch: '/main' } },
  changes: [],
  fileConflicts: paths.map((path) => ({ path, itemId: 425954, baseChangeset: 16828, sourceChangeset: 17092, destinationChangeset: 16973 })),
  directoryConflicts: [],
  warnings: [],
});

// `cm ls <paths> --tree=cs:278738 --xml` in acme@acme@cloud, where editor-plugin is an xlink to editorGUI, trimmed.
const LISTING = `<?xml version="1.0" encoding="utf-8"?>
<LsResults><LsItems>
  <LsItem><Status>Controlled</Status><Name>DiffWindowMockExtensions.cs</Name><WkPath>${XLINKED}</WkPath><Type>txt</Type>
    <Changeset>17092</Changeset><Repository>rep:editorGUI@acme@cloud</Repository><RevId>432251</RevId><ItemId>425954</ItemId></LsItem>
  <LsItem><Status>Controlled</Status><Name>MergePrinter.cs</Name><WkPath>${OWN}</WkPath><Type>txt</Type>
    <Changeset>276520</Changeset><Repository>rep:acme@acme@cloud</Repository><RevId>31259533</RevId><ItemId>420525</ItemId></LsItem>
</LsItems></LsResults>`;

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
    expect(conflictListingArgs(plan([XLINKED, OWN]), 'cs:278648')).toEqual(['ls', XLINKED, OWN, '--tree=cs:278648', '--xml']);
  });
});

describe('withRepositories', () => {
  it("names the xlinked repository of a file under a writable xlink, and the merged one's for the others, with the destination's revision there", () => {
    expect(withRepositories(plan([XLINKED, OWN]), parseTreeItems(LISTING)).fileConflicts.map(({ path, repository, destinationRevisionId }) => ({ path, repository, destinationRevisionId }))).toEqual([
      { path: XLINKED, repository: 'editorGUI@acme@cloud', destinationRevisionId: 432251 },
      { path: OWN, repository: 'acme@acme@cloud', destinationRevisionId: 31259533 },
    ]);
  });

  it('fails rather than read a conflicting file in a repository it may not be in', () => {
    expect(() => withRepositories(plan([XLINKED, '/elsewhere.cs']), parseTreeItems(LISTING))).toThrow('/elsewhere.cs');
  });

  it("fails rather than read a destination's version the listing names no revision of", () => {
    const withoutRevision = parseTreeItems(LISTING).map((item) => (item.path === OWN.slice(1) ? { ...item, revisionId: -1 } : item));
    expect(() => withRepositories(plan([XLINKED, OWN]), withoutRevision)).toThrow(`Couldn't tell which version of ${OWN} the destination has.`);
  });

  it('keeps a plan without file conflicts as it is', () => {
    expect(withRepositories(plan([]), []).fileConflicts).toEqual([]);
  });
});
