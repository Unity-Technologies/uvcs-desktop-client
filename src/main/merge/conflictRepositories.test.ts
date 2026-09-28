import { describe, expect, it } from 'vitest';
import type { PrintedMergePlan } from '../cm/mergeOutput';
import { conflictListingArgs, destinationTree, withRepositories } from './conflictRepositories';

const XLINKED = '/01plastic/src/client/plugins/unity-plugin/Packages/com.unity.collab-proxy.tests/Infrastructure/UnityDiffWindowMockExtensions.cs';
const OWN = '/01plastic/src/client/cm/commands/merge/MergePrinter.cs';

const plan = (paths: string[]): PrintedMergePlan => ({
  status: 'ready',
  contributors: { source: { changesetId: 278738, branch: '/main/scm1008583' }, destination: { changesetId: 278648, branch: '/main' } },
  changes: [],
  fileConflicts: paths.map((path) => ({ path, itemId: 425954, baseChangeset: 16828, sourceChangeset: 17092, destinationChangeset: 16973 })),
  directoryConflicts: [],
  warnings: [],
});

// `cm ls <paths> --tree=cs:278738 --xml` in codice@codice@cloud, where unity-plugin is an xlink to unityGUI, trimmed.
const LISTING = `<?xml version="1.0" encoding="utf-8"?>
<LsResults><LsItems>
  <LsItem><Status>Controlled</Status><Name>UnityDiffWindowMockExtensions.cs</Name><WkPath>${XLINKED}</WkPath><Type>txt</Type>
    <Changeset>17092</Changeset><Repository>rep:unityGUI@codice@cloud</Repository><RevId>432251</RevId><ItemId>425954</ItemId></LsItem>
  <LsItem><Status>Controlled</Status><Name>MergePrinter.cs</Name><WkPath>${OWN}</WkPath><Type>txt</Type>
    <Changeset>276520</Changeset><Repository>rep:codice@codice@cloud</Repository><RevId>31259533</RevId><ItemId>420525</ItemId></LsItem>
</LsItems></LsResults>`;

describe('destinationTree', () => {
  it('is the destination contributor, else the branch merged into, else the workspace tells', () => {
    const withoutContributors = { ...plan([OWN]), contributors: undefined };
    expect(destinationTree({ kind: 'merge', sourceSpec: 'br:/main/scm1008583' }, plan([OWN]))).toBe('cs:278648');
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
  it("names the xlinked repository of a file under a writable xlink, and the merged one's for the others", () => {
    expect(withRepositories(plan([XLINKED, OWN]), LISTING).fileConflicts.map(({ path, repository }) => ({ path, repository }))).toEqual([
      { path: XLINKED, repository: 'unityGUI@codice@cloud' },
      { path: OWN, repository: 'codice@codice@cloud' },
    ]);
  });

  it('fails rather than read a conflicting file in a repository it may not be in', () => {
    expect(() => withRepositories(plan([XLINKED, '/elsewhere.cs']), LISTING)).toThrow('/elsewhere.cs');
  });

  it('keeps a plan without file conflicts as it is', () => {
    expect(withRepositories(plan([]), '').fileConflicts).toEqual([]);
  });
});
