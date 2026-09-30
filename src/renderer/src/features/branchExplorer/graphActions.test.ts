import '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

// Opening never switches: the switch flow and all it loads stay out.
vi.mock('../../app/shell/workspaceOperations', () => ({ switchWorkspace: () => Promise.resolve(false) }));

import { whereTheWindowIs } from '../../testing/operationOutcome';
import { openSelection } from './graphActions';
import { sampleHistory } from './model/graphFixtures';
import { layoutGraph } from './model/layoutGraph';

const layout = layoutGraph(sampleHistory(), undefined, { branch: '/main/a', parent: 5, mergeLinks: [] });

describe('openSelection: Enter and a double-click', () => {
  it('opens a changeset’s diff', () => {
    openSelection(layout, { kind: 'changeset', id: 4 }, 'game@local');

    expect(whereTheWindowIs().pages).toEqual([{ kind: 'diff', title: 'Changeset 4', target: { kind: 'changeset', changesetId: 4 } }]);
  });

  it('opens a label’s changes when the selection came from its chip', () => {
    openSelection(layout, { kind: 'changeset', id: 6, label: 'v1' }, 'game@local');

    expect(whereTheWindowIs().pages).toMatchObject([{ kind: 'diff', title: 'Label v1', target: { kind: 'changeset', changesetId: 6 } }]);
  });

  it('opens a branch’s diff at its head', () => {
    openSelection(layout, { kind: 'branch', name: '/main/b' }, 'game@local');

    expect(whereTheWindowIs().pages).toMatchObject([{ kind: 'diff', title: 'Branch /main/b', target: { kind: 'branch', branch: '/main/b' }, branchHead: 7 }]);
  });

  it('goes to Changes for the pending changes', () => {
    openSelection(layout, { kind: 'pending' }, 'game@local');

    expect(whereTheWindowIs()).toEqual({ view: 'changes', pages: [] });
  });

  it('opens nothing without a selection, or for a branch the graph no longer draws', () => {
    openSelection(layout, null, 'game@local');
    openSelection(layout, { kind: 'branch', name: '/gone' }, 'game@local');

    expect(whereTheWindowIs().pages).toEqual([]);
  });
});
