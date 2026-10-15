import { describe, expect, it } from 'vitest';
import { buildModelScene } from './modelScene';
import { modelSummary } from './modelSummary';
import { SceneMaterials } from './sceneMaterials';
import { testModel } from './testing/testModels';

describe('SceneMaterials', () => {
  it('makes one clay material per slot name and emphasis, however many meshes ask', () => {
    const materials = new SceneMaterials();
    expect(materials.clay('Wood', 'plain')).toBe(materials.clay('Wood', 'plain'));
    expect(materials.clay('Wood', 'plain')).not.toBe(materials.clay('Wood', 'lit'));
    expect(materials.clay('Wood', 'plain')).not.toBe(materials.clay('Metal', 'plain'));
    expect(materials.eachClay().map(({ slot, emphasis }) => `${slot} ${emphasis}`).sort()).toEqual(['Metal plain', 'Wood lit', 'Wood plain']);
  });

  it('makes one wire material per emphasis', () => {
    const materials = new SceneMaterials();
    expect(materials.wire('faded')).toBe(materials.wire('faded'));
    expect(materials.eachWire().map(({ emphasis }) => emphasis)).toEqual(['faded']);
  });
});

describe('buildModelScene, materials', () => {
  it("shares the materials of the meshes drawn alike: a 3,000-part model doesn't make 3,000 of each", () => {
    const parts = Array.from({ length: 50 }, (_, i) => ({ name: `Part${i}`, mesh: {} }));
    const model = testModel({ nodes: parts });
    const scene = buildModelScene(model, modelSummary(model));
    const distinct = (pick: (mesh: (typeof scene.meshes)[number]) => unknown) => new Set(scene.meshes.map(pick)).size;
    expect([distinct((mesh) => mesh.clay[0]), distinct((mesh) => mesh.wire.material), distinct((mesh) => mesh.heat.material), distinct((mesh) => mesh.ghost.material)]).toEqual([1, 1, 1, 1]);
  });
});
