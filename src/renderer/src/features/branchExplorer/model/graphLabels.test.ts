import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { labelInfo, selectedLabel } from './graphLabels';
import { layoutGraph } from './layoutGraph';

const layout = layoutGraph(sampleHistory());
const v1 = { name: 'v1', changeset: 6, owner: 'jane@example.com', date: '2026-09-07T00:00:00Z', comment: '', branch: '/main', repository: 'game@local' };

describe('labelInfo', () => {
  it('takes the branch from the labeled changeset and the repository given', () => {
    expect(labelInfo(layout, sampleHistory().labels[0]!, 'game@local')).toEqual(v1);
  });
});

describe('selectedLabel', () => {
  it('finds the label chip selected on its changeset', () => {
    expect(selectedLabel(layout, { kind: 'changeset', id: 6, label: 'v1' }, 'game@local')).toEqual(v1);
  });

  it('is nothing for a changeset selected by itself, or a label the graph no longer draws', () => {
    expect(selectedLabel(layout, { kind: 'changeset', id: 6 }, 'game@local')).toBeUndefined();
    expect(selectedLabel(layout, { kind: 'changeset', id: 6, label: 'v2' }, 'game@local')).toBeUndefined();
    expect(selectedLabel(layout, { kind: 'branch', name: '/main' }, 'game@local')).toBeUndefined();
  });
});
