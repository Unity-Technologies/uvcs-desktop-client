import { describe, expect, it } from 'vitest';
import { groupBy } from './groupBy';

describe('groupBy', () => {
  it('groups the items by key, each group and the groups in the order the items come', () => {
    const labels = [
      { name: 'v2', changeset: 9 },
      { name: 'v1', changeset: 4 },
      { name: 'rc', changeset: 9 },
    ];

    expect([...groupBy(labels, (label) => label.changeset)]).toEqual([
      [9, [labels[0], labels[2]]],
      [4, [labels[1]]],
    ]);
  });

  it('has no groups for no items', () => {
    expect(groupBy([], () => 1).size).toBe(0);
  });
});
