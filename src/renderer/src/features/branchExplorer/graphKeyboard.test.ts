import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { keyboardMergeSource, keyboardMoveLane } from './graphKeyboard';
import { branch, changeset } from './model/graphFixtures';
import { layoutGraph } from './model/layoutGraph';

describe('keyboardMergeSource', () => {
  it('merges the changeset or branch selected into the workspace', () => {
    expect(keyboardMergeSource({ kind: 'changeset', id: 7 }, true)).toBe('cs:7');
    expect(keyboardMergeSource({ kind: 'branch', name: '/main/task' }, true)).toBe('br:/main/task');
    expect(keyboardMergeSource({ kind: 'pending' }, true)).toBeNull();
    expect(keyboardMergeSource(null, true)).toBeNull();
  });

  it('merges nothing in a repository explored without a workspace: there is none to merge into', () => {
    expect(keyboardMergeSource({ kind: 'changeset', id: 7 }, false)).toBeNull();
    expect(keyboardMergeSource({ kind: 'branch', name: '/main/task' }, false)).toBeNull();
  });
});

describe('keyboardMoveLane', () => {
  const layout = layoutGraph({
    branches: [branch('/main', '', 1), branch('/main/task', '/main', 2)].map((each, index) => ({ ...each, id: index + 1 })),
    changesets: [changeset(0, '/main', -1), changeset(1, '/main/task', 0)],
    mergeLinks: [],
    labels: [],
  });

  it('moves the branch selected, or the branch of the changeset selected', () => {
    expect(keyboardMoveLane(layout, { kind: 'branch', name: '/main/task' })?.branch.name).toBe('/main/task');
    expect(keyboardMoveLane(layout, { kind: 'changeset', id: 1 })?.branch.name).toBe('/main/task');
  });

  it('moves nothing with nothing on a drawn branch selected, so the key is left to the rest of the window', () => {
    expect(keyboardMoveLane(layout, null)).toBeNull();
    expect(keyboardMoveLane(layout, { kind: 'branch', name: '/main/gone' })).toBeNull();
    expect(keyboardMoveLane(layout, { kind: 'changeset', id: 99 })).toBeNull();
  });
});
