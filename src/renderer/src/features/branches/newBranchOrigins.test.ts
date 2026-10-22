import { describe, expect, it } from 'vitest';
import { startingPointCards, type NewBranchOrigin } from './newBranchOrigins';

const latestMain: NewBranchOrigin = {
  parentBranch: '/main',
  startingPoint: 'cs:14',
  startingPointLabel: 'the latest /main (changeset 14)',
  card: { title: 'main (latest, changeset 14)', description: 'Start something new, independent of your current work.' },
};
const loaded: NewBranchOrigin = { parentBranch: '/main/task001', startingPoint: 'cs:64', startingPointLabel: "your workspace's changeset 64" };

describe('startingPointCards', () => {
  it('offers no choice with a single starting point', () => {
    expect(startingPointCards([latestMain])).toBeNull();
  });

  it('offers each starting point as a card, valued by its place', () => {
    expect(startingPointCards([latestMain, { ...loaded, card: { title: 'task001 (changeset 64, what you have loaded)', description: 'Continue building on its existing changes.' } }])).toEqual([
      { value: '0', title: 'main (latest, changeset 14)', description: 'Start something new, independent of your current work.' },
      { value: '1', title: 'task001 (changeset 64, what you have loaded)', description: 'Continue building on its existing changes.' },
    ]);
  });

  it('names a starting point without a card by its label', () => {
    expect(startingPointCards([latestMain, loaded])![1]).toEqual({ value: '1', title: "your workspace's changeset 64", description: '' });
  });
});
