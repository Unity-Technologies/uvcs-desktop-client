import { describe, expect, it } from 'vitest';
import { followedObject } from './followedObject';
import { branch, sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';

const layout = layoutGraph(sampleHistory());
const followed = (selection: Parameters<typeof followedObject>[1]) => followedObject(layout, selection, 'game@local');

describe('followedObject', () => {
  it('is the label chip, the changeset or the branch selected', () => {
    expect(followed({ kind: 'changeset', id: 6, label: 'v1' })).toEqual({ kind: 'label', label: expect.objectContaining({ name: 'v1', changeset: 6 }) });
    expect(followed({ kind: 'changeset', id: 6 })).toEqual({ kind: 'changeset', id: 6 });
    expect(followed({ kind: 'branch', name: '/main/a' })).toEqual({ kind: 'branch', branch: branch('/main/a', '/main', 5) });
  });

  it('is nothing for the pending changes, no selection, or what the graph no longer draws', () => {
    expect(followed({ kind: 'pending' })).toBeNull();
    expect(followed(null)).toBeNull();
    expect(followed({ kind: 'changeset', id: 99 })).toBeNull();
    expect(followed({ kind: 'branch', name: '/main/gone' })).toBeNull();
  });
});
