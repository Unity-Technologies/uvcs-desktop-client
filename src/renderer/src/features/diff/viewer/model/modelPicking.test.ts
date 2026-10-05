import { describe, expect, it } from 'vitest';
import { aroundPoints, clickedNode } from './modelPicking';
import { modelSummary } from './modelSummary';
import { matchNodes } from './nodeMatching';
import { testModel } from './testing/testModels';

describe('clickedNode', () => {
  it('lights up the part clicked and its match on the other side', () => {
    const before = modelSummary(testModel({ nodes: [{ name: 'Hand_L', kind: 'bone', position: [0.5, 1, 0] }] }));
    const after = modelSummary(testModel({ nodes: [{ name: 'hand.L', kind: 'bone', position: [0.5, 1, 0] }] }));
    expect(clickedNode('after', 'hand.L', before, after, matchNodes(before, after))).toEqual({ name: 'hand.L', path: 'hand.L', kind: 'bone', after: 'hand.L', before: 'Hand_L' });
  });

  it('lights up only the side clicked when the part has no match', () => {
    const after = modelSummary(testModel({ nodes: [{ name: 'Antenna', mesh: {} }] }));
    expect(clickedNode('after', 'Antenna', null, after, null)).toEqual({ name: 'Antenna', path: 'Antenna', kind: 'mesh', after: 'Antenna' });
  });
});

describe('aroundPoints', () => {
  it('frames the points with a third of the model around them', () => {
    const model = { min: [0, 0, 0] as [number, number, number], max: [1, 2, 1] as [number, number, number] };
    expect(aroundPoints({ before: [[0, 1, 0]], after: [[0.5, 1, 0]] }, model)).toEqual({ min: [-0.6, 0.4, -0.6], max: [1.1, 1.6, 0.6] });
    expect(aroundPoints({ before: [], after: [] }, model)).toBeNull();
  });
});
