import { describe, expect, it } from 'vitest';
import { modelSummary } from './modelSummary';
import { matchNodes } from './nodeMatching';
import { testModel, type TestNode } from './testing/testModels';

const summaryOf = (nodes: TestNode[]) => modelSummary(testModel({ nodes }));

/** The matching, in node names: renamed and moved pairs, and what has no match on either side. */
function matching(before: TestNode[], after: TestNode[]) {
  const old = summaryOf(before);
  const next = summaryOf(after);
  const result = matchNodes(old, next);
  const name = (summary: typeof old, index: number): string => summary.nodes[index]!.name;
  return {
    renamed: result.renamed.map(([b, a]) => `${name(old, b)} → ${name(next, a)}`),
    moved: result.moved.map(([b, a]) => `${old.nodes[b]!.path} → ${next.nodes[a]!.path}`),
    removed: result.afterOf.flatMap((a, b) => (a === -1 ? [name(old, b)] : [])),
    added: result.beforeOf.flatMap((b, a) => (b === -1 ? [name(next, a)] : [])),
  };
}

const NOTHING = { renamed: [], moved: [], removed: [], added: [] };

const arm: TestNode[] = [
  { name: 'Hips', kind: 'bone' },
  { name: 'Arm_L', parent: 'Hips', kind: 'bone', position: [0.2, 1.4, 0] },
  { name: 'Hand_L', parent: 'Arm_L', kind: 'bone', position: [0.3, 0, 0] },
  { name: 'Index_L', parent: 'Hand_L', kind: 'bone', position: [0.1, 0, 0] },
];

describe('matchNodes', () => {
  it('matches every node of an unchanged hierarchy by name', () => {
    expect(matching(arm, arm)).toEqual(NOTHING);
  });

  it('reads a node with another name under the same parent as renamed, its children as kept', () => {
    const renamed = arm.map((node) => (node.name === 'Hand_L' ? { ...node, name: 'hand.L' } : node.parent === 'Hand_L' ? { ...node, parent: 'hand.L' } : node));
    expect(matching(arm, renamed)).toEqual({ ...NOTHING, renamed: ['Hand_L → hand.L'] });
  });

  it('pairs renamed siblings by likeness, not by order', () => {
    const before: TestNode[] = [
      { name: 'Wheel_FL', mesh: { size: [1, 1, 1] }, position: [1, 0, 1] },
      { name: 'Wheel_FR', mesh: { size: [1, 1, 1] }, position: [-1, 0, 1] },
    ];
    const after: TestNode[] = [
      { name: 'wheel_front_right', mesh: { size: [1, 1, 1] }, position: [-1, 0, 1] },
      { name: 'wheel_front_left', mesh: { size: [1, 1, 1] }, position: [1, 0, 1] },
    ];
    expect(matching(before, after).renamed.sort()).toEqual(['Wheel_FL → wheel_front_left', 'Wheel_FR → wheel_front_right']);
  });

  it('reads a node found under another parent as moved', () => {
    const before: TestNode[] = [{ name: 'Head', kind: 'bone' }, { name: 'Body' }, { name: 'Helmet', parent: 'Body', mesh: {} }];
    const after: TestNode[] = [{ name: 'Head', kind: 'bone' }, { name: 'Body' }, { name: 'Helmet', parent: 'Head', mesh: {} }];
    expect(matching(before, after)).toEqual({ ...NOTHING, moved: ['Body/Helmet → Head/Helmet'] });
  });

  it('reads nodes with nothing alike as removed and added', () => {
    const before: TestNode[] = [{ name: 'Backpack', mesh: { size: [1, 1, 1] } }, { name: 'Antenna', kind: 'bone' }];
    const after: TestNode[] = [{ name: 'Visor', mesh: { size: [3, 1, 1] }, position: [0, 2, 0] }, { name: 'Tail', kind: 'bone', position: [0, 0, -1] }];
    // One mesh and one bone left on each side: kinds don't pair across, but each kind alone is a rename.
    expect(matching(before, after)).toEqual({ ...NOTHING, renamed: ['Backpack → Visor', 'Antenna → Tail'] });
    const withSecond: TestNode[] = [...after, { name: 'Cape', mesh: { size: [2, 2, 2] }, position: [0, 0, 3] }];
    expect(matching(before, withSecond)).toMatchObject({ renamed: ['Antenna → Tail'], removed: ['Backpack'], added: ['Visor', 'Cape'] });
  });

  it('keeps siblings of one name apart, in order', () => {
    const wheels: TestNode[] = [{ name: 'Wheel', mesh: {} }, { name: 'Wheel', mesh: {} }];
    expect(matching(wheels, wheels)).toEqual(NOTHING);
    expect(matching(wheels, wheels.slice(0, 1))).toEqual({ ...NOTHING, removed: ['Wheel'] });
  });

  it('matches a mesh that became skinned, as the same GameObject', () => {
    expect(matching([{ name: 'Body', mesh: {} }], [{ name: 'Body', kind: 'skinnedMesh', mesh: {} }])).toEqual(NOTHING);
  });
});
