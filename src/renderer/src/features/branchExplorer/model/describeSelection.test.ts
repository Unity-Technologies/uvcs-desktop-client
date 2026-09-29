import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { describeSelection } from './describeSelection';
import { layoutGraph } from './layoutGraph';

const layout = layoutGraph(sampleHistory());

describe('describeSelection', () => {
  it('reads a changeset by number, first comment line, author and branch', () => {
    expect(describeSelection(layout, { kind: 'changeset', id: 5 }, null)).toBe('Changeset 5, Finish feature, by Jane, /main/a');
  });

  it('says when a changeset has no comment, and when it is the workspace changeset', () => {
    expect(describeSelection(layout, { kind: 'changeset', id: 3 }, 3)).toBe('Changeset 3, no comment, by Jane, /main, the workspace changeset');
  });

  it('reads a label by name, then its changeset', () => {
    expect(describeSelection(layout, { kind: 'changeset', id: 6, label: 'v1' }, null)).toBe('Label v1 on changeset 6, Merge a, by Jane, /main');
  });

  it('reads a branch by name, and nothing without a selection', () => {
    expect(describeSelection(layout, { kind: 'branch', name: '/main/b' }, null)).toBe('Branch /main/b');
    expect(describeSelection(layout, null, null)).toBe('');
  });
});
