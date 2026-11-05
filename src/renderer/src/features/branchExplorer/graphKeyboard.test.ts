import '../../testing/fakeWindow';
import type { KeyboardEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graphActions } from './graphActions';
import { handleGraphKey, keyboardMergeSource, keyboardMoveLane, type GraphKeyboard } from './graphKeyboard';
import type { GraphSelection } from './graphSelection';
import { branch, changeset, sampleHistory } from './model/graphFixtures';
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

function keyPressed(key: string): KeyboardEvent {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  const nativeEvent = { key, code, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };
  return { key, nativeEvent, target: {}, currentTarget: { contains: () => true }, preventDefault: () => {} } as unknown as KeyboardEvent;
}

function keyboardOn(selection: GraphSelection, selected: (GraphSelection | null)[]): GraphKeyboard {
  return {
    layout: layoutGraph(sampleHistory()),
    selection,
    select: (next) => selected.push(next),
    homeChangeset: 6,
    repository: 'game@local',
    inWorkspace: true,
    canvas: { current: null },
    goHome: () => {},
    find: () => {},
    fit: () => {},
    zoomBy: () => {},
    toggleDetails: () => {},
    exitFocus: () => {},
    positions: null,
  };
}

describe('the keys that act on one object', () => {
  beforeEach(() => vi.stubGlobal('HTMLElement', class {}));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('select the lead alone, then act on it: M merges the lead', () => {
    const merge = vi.spyOn(graphActions, 'merge').mockImplementation(() => {});
    const selected: (GraphSelection | null)[] = [];
    handleGraphKey(keyPressed('m'), keyboardOn({ kind: 'branch', name: '/main/a' }, selected));
    expect(selected).toEqual([{ kind: 'branch', name: '/main/a' }]);
    expect(merge).toHaveBeenCalledWith('merge', 'br:/main/a');
  });

  it('Enter diffs the lead', () => {
    const diff = vi.spyOn(graphActions, 'diffChangeset').mockImplementation(() => {});
    const selected: (GraphSelection | null)[] = [];
    handleGraphKey(keyPressed('Enter'), keyboardOn({ kind: 'changeset', id: 4 }, selected));
    expect(selected).toEqual([{ kind: 'changeset', id: 4 }]);
    expect(diff).toHaveBeenCalledWith(4);
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
