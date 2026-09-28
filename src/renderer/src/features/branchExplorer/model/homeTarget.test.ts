import { describe, expect, it } from 'vitest';
import { branch, sampleHistory } from './graphFixtures';
import { homeTarget } from './homeTarget';
import { layoutGraph } from './layoutGraph';

describe('homeTarget', () => {
  const data = sampleHistory();
  // /main/new starts from changeset 6 and has no changesets of its own yet.
  const withNewBranch = { ...data, branches: [...data.branches, branch('/main/new', '/main', 6)] };

  it('is the pending changes when there are some, where the home badge is', () => {
    expect(homeTarget(layoutGraph(data, undefined, { branch: '/main/a', parent: 5, mergeLinks: [] }), 5, '/main/a')).toEqual({ kind: 'pending' });
    expect(homeTarget(layoutGraph(withNewBranch, undefined, { branch: '/main/new', parent: 6, mergeLinks: [] }), 6, '/main/new')).toEqual({ kind: 'pending' });
  });

  it('is the branch without changesets the workspace is on, not the changeset it starts from', () => {
    expect(homeTarget(layoutGraph(withNewBranch), 6, '/main/new')).toEqual({ kind: 'branch', name: '/main/new' });
  });

  it('is the loaded changeset otherwise, and nothing out of the graph', () => {
    expect(homeTarget(layoutGraph(data), 5, '/main/a')).toEqual({ kind: 'changeset', id: 5 });
    // On a label or a changeset: no branch of its own.
    expect(homeTarget(layoutGraph(data), 3, null)).toEqual({ kind: 'changeset', id: 3 });
    expect(homeTarget(layoutGraph(data), 99, '/main/gone')).toBeNull();
  });
});
