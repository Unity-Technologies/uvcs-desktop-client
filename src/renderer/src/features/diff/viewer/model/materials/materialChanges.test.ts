import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_SETTINGS, type ModelImportSettings } from '../modelImportSettings';
import { materialChanges, materialsMayDiffer } from './materialChanges';
import { assetsRequest, type PlannedSlot, type ResolvedMaterial, type ResolvedSlot, type SlotTexture, type VersionPlan } from './materialPlan';
import { slotSources, type ModelMaterialsInput } from './slotSources';
import { fileMaterial, named, use } from './testing/testMaterials';

const DEFAULT: ResolvedMaterial = { kind: 'default' };
/** A project's material, its GUID and file told by its name unless given. */
const project = (name: string, path = `Assets/Materials/${name}.mat`): ResolvedMaterial => ({ kind: 'project', guid: path, name, path });
const own = (name: string): ResolvedMaterial => ({ kind: 'file', name });

const texture = (name: string, overrides: Partial<SlotTexture> = {}): SlotTexture => ({ id: `Assets/Textures/${name}`, name, missing: false, repeat: [1, 1], offset: [0, 0], ...overrides });

function look(overrides: Partial<PlannedSlot> = {}): PlannedSlot {
  return { color: [1, 1, 1], colorWithMap: [1, 1, 1], opacity: 1, alpha: 'opaque', cutoff: 0.5, doubleSided: false, baseMap: null, normalMap: null, ...overrides };
}

interface TestSlot {
  material: ResolvedMaterial;
  look?: Partial<PlannedSlot>;
  baseMap?: SlotTexture;
  normalMap?: SlotTexture;
}

/** A version whose slots resolved as told, drawn as told (clay for the default and missing materials). */
function version(slots: Record<string, TestSlot>): VersionPlan {
  const resolved = new Map<string, ResolvedSlot>();
  const planned = new Map<string, PlannedSlot | null>();
  for (const [name, slot] of Object.entries(slots)) {
    resolved.set(name, { slot: name, material: slot.material, baseMap: slot.baseMap ?? null, normalMap: slot.normalMap ?? null });
    const drawn = slot.material.kind === 'project' || slot.material.kind === 'file';
    const maps = { baseMap: slot.baseMap && !slot.baseMap.missing ? { need: slot.baseMap.id, repeat: slot.baseMap.repeat, offset: slot.baseMap.offset, rotation: 0, channel: 0 } : null };
    planned.set(name, drawn ? look({ ...maps, ...slot.look }) : null);
  }
  return { slots: planned, resolved, needs: [], issues: [] };
}

describe('materialChanges: where a slot takes its material from', () => {
  it("tells a slot that now takes a project's material instead of Unity's default, and the reverse", () => {
    const before = version({ Metal: { material: DEFAULT }, Glass: { material: DEFAULT }, Wood: { material: project('Lantern_Wood') } });
    const after = version({ Metal: { material: project('Lantern_Metal') }, Glass: { material: project('Lantern_Glass') }, Wood: { material: DEFAULT } });
    expect(materialChanges(before, after)).toEqual([
      { kind: 'source', slot: 'Metal', before: DEFAULT, after: project('Lantern_Metal') },
      { kind: 'source', slot: 'Glass', before: DEFAULT, after: project('Lantern_Glass') },
      { kind: 'source', slot: 'Wood', before: project('Lantern_Wood'), after: DEFAULT },
    ]);
  });

  it("tells a project material swapped for another, and the file's own material swapped for a project's", () => {
    const before = version({ Ball: { material: project('Ball_Planks') }, Body: { material: own('Body') } });
    const after = version({ Ball: { material: project('Ball_Rock') }, Body: { material: project('Body_URP') } });
    expect(materialChanges(before, after)).toEqual([
      { kind: 'source', slot: 'Ball', before: project('Ball_Planks'), after: project('Ball_Rock') },
      { kind: 'source', slot: 'Body', before: own('Body'), after: project('Body_URP') },
    ]);
  });

  it('tells a project material swapped for another of the same name in another folder', () => {
    const before = version({ Ball: { material: project('Wood', 'Assets/Props/Wood.mat') } });
    const after = version({ Ball: { material: project('Wood', 'Assets/Balls/Wood.mat') } });
    expect(materialChanges(before, after)).toEqual([{ kind: 'source', slot: 'Ball', before: project('Wood', 'Assets/Props/Wood.mat'), after: project('Wood', 'Assets/Balls/Wood.mat') }]);
  });

  it("tells a slot now remapped to a material the project hasn't, and nothing for one that already was", () => {
    const before = version({ Glass: { material: project('Lantern_Glass') }, Cap: { material: { kind: 'missing' } } });
    const after = version({ Glass: { material: { kind: 'missing' } }, Cap: { material: { kind: 'missing' } } });
    expect(materialChanges(before, after)).toEqual([{ kind: 'source', slot: 'Glass', before: project('Lantern_Glass'), after: { kind: 'missing' } }]);
  });

  it('tells nothing of a slot only one version has: the slot changes tell that', () => {
    expect(materialChanges(version({ Old: { material: DEFAULT } }), version({ New: { material: project('New') } }))).toEqual([]);
  });

  it('tells nothing when every slot resolved alike', () => {
    const slots = { Wood: { material: own('Wood'), baseMap: texture('planks.png') }, Metal: { material: project('Metal') }, Clay: { material: DEFAULT } };
    expect(materialChanges(version(slots), version(slots))).toEqual([]);
  });
});

describe("materialChanges: a glTF's materials, keyed by their place in the file", () => {
  /** A glTF version: each of its materials at its place (`#0`, `#1`…), by name ('' for none). */
  function gltf(materials: [string, TestSlot][]): VersionPlan {
    const named = version(Object.fromEntries(materials.map(([, slot], i) => [`#${i}`, slot])));
    for (const [key, slot] of named.resolved) named.resolved.set(key, { ...slot, slot: materials[Number(key.slice(1))]![0] });
    return named;
  }
  const material = (name: string, slot: Partial<TestSlot> = {}): [string, TestSlot] => [name, { material: own(name), ...slot }];

  it('pairs them by name, so a material added first moves none of the others', () => {
    const before = gltf([material('Wood', { baseMap: texture('planks.png') }), material('Metal')]);
    const after = gltf([material('Grass'), material('Wood', { baseMap: texture('rock.png') }), material('Metal')]);
    expect(materialChanges(before, after)).toEqual([{ kind: 'baseMap', slot: 'Wood', before: 'planks.png', after: 'rock.png' }]);
  });

  it("pairs none without a name, or with a name another of the file's materials has: nothing tells which is which", () => {
    expect(materialChanges(gltf([material(''), material('')]), gltf([material('', { look: { alpha: 'blend' } }), material('')]))).toEqual([]);
    expect(materialChanges(gltf([material('Leaf'), material('Leaf')]), gltf([material('Leaf', { look: { alpha: 'blend' } }), material('Leaf')]))).toEqual([]);
  });
});

describe('materialChanges: within the same material', () => {
  it("compares a slot's own material on both sides whatever the file calls it: never a change of where it comes from", () => {
    const before = version({ Body: { material: own('Body') } });
    const after = version({ Body: { material: own('Body_old'), look: { doubleSided: true } } });
    expect(materialChanges(before, after)).toEqual([{ kind: 'doubleSided', slot: 'Body', now: true }]);
  });

  const wood = (slot: Partial<TestSlot>): VersionPlan => version({ Wood: { material: own('Wood'), ...slot } });

  it('tells a base map that is another texture file, one added and one taken away', () => {
    expect(materialChanges(wood({ baseMap: texture('planks.png') }), wood({ baseMap: texture('rock.png') }))).toEqual([{ kind: 'baseMap', slot: 'Wood', before: 'planks.png', after: 'rock.png' }]);
    expect(materialChanges(wood({}), wood({ baseMap: texture('rock.png') }))).toEqual([{ kind: 'baseMap', slot: 'Wood', before: null, after: 'rock.png' }]);
    expect(materialChanges(wood({ baseMap: texture('rock.png') }), wood({}))).toEqual([{ kind: 'baseMap', slot: 'Wood', before: 'rock.png', after: null }]);
  });

  it('tells a normal map added or removed', () => {
    expect(materialChanges(wood({}), wood({ normalMap: texture('planks_n.png') }))).toEqual([{ kind: 'normalMap', slot: 'Wood', before: null, after: 'planks_n.png' }]);
    expect(materialChanges(wood({ normalMap: texture('planks_n.png') }), wood({}))).toEqual([{ kind: 'normalMap', slot: 'Wood', before: 'planks_n.png', after: null }]);
  });

  it('tells the base color as the Inspector shows it, ignoring what rounds to the same', () => {
    expect(materialChanges(wood({ look: { color: [1, 0, 0] } }), wood({ look: { color: [0, 0, 1] } }))).toEqual([{ kind: 'baseColor', slot: 'Wood', before: '#FF0000', after: '#0000FF' }]);
    expect(materialChanges(wood({ look: { color: [0.5, 0.5, 0.5] } }), wood({ look: { color: [0.5001, 0.5, 0.5] } }))).toEqual([]);
  });

  it("tells no color under a base map Unity draws untinted, only the one it draws", () => {
    const planks = texture('planks.png');
    expect(materialChanges(wood({ baseMap: planks, look: { color: [1, 0, 0] } }), wood({ baseMap: planks, look: { color: [0, 0, 1] } }))).toEqual([]);
  });

  it('tells the opacity of one transparent on both sides, as the Inspector keeps it, in 8 bits', () => {
    expect(materialChanges(wood({ look: { alpha: 'blend', opacity: 0.4 } }), wood({ look: { alpha: 'blend', opacity: 0.6 } }))).toEqual([{ kind: 'opacity', slot: 'Wood', before: 0.4, after: 0.6 }]);
    expect(materialChanges(wood({ look: { alpha: 'blend', opacity: 0.4 } }), wood({ look: { alpha: 'blend', opacity: 0.4001 } }))).toEqual([]);
    // Compared as it is told, in whole percents: never "40% → 40%".
    expect(materialChanges(wood({ look: { alpha: 'blend', opacity: 0.4 } }), wood({ look: { alpha: 'blend', opacity: 0.402 } }))).toEqual([]);
    expect(materialChanges(wood({ look: { opacity: 1 } }), wood({ look: { alpha: 'blend', opacity: 0.5 } }))).toEqual([{ kind: 'alpha', slot: 'Wood', before: 'opaque', after: 'blend' }]);
  });

  it('tells the alpha mode, the cutoff of one clipped on both sides, and both sides drawn or one', () => {
    expect(materialChanges(wood({}), wood({ look: { alpha: 'blend' } }))).toEqual([{ kind: 'alpha', slot: 'Wood', before: 'opaque', after: 'blend' }]);
    expect(materialChanges(wood({ look: { alpha: 'clip', cutoff: 0.5 } }), wood({ look: { alpha: 'clip', cutoff: 0.8 } }))).toEqual([{ kind: 'cutoff', slot: 'Wood', before: 0.5, after: 0.8 }]);
    expect(materialChanges(wood({ look: { cutoff: 0.5 } }), wood({ look: { cutoff: 0.8 } }))).toEqual([]);
    expect(materialChanges(wood({}), wood({ look: { doubleSided: true } }))).toEqual([{ kind: 'doubleSided', slot: 'Wood', now: true }]);
  });

  it("tells the base map's tiling and offset", () => {
    const before = wood({ baseMap: texture('planks.png') });
    const after = wood({ baseMap: texture('planks.png', { repeat: [2, 2], offset: [0.5, 0] }) });
    expect(materialChanges(before, after)).toEqual([{ kind: 'tiling', slot: 'Wood', before: { repeat: [1, 1], offset: [0, 0] }, after: { repeat: [2, 2], offset: [0.5, 0] } }]);
  });

  it('tells nothing of the look of a slot whose material changed: its source says it', () => {
    const before = version({ Ball: { material: project('Ball_Planks'), baseMap: texture('planks.png') } });
    const after = version({ Ball: { material: project('Ball_Rock'), baseMap: texture('rock.png'), look: { alpha: 'clip' } } });
    expect(materialChanges(before, after).map((change) => change.kind)).toEqual(['source']);
  });
});

describe('materialsMayDiffer', () => {
  const metal = fileMaterial('Metal', { baseMap: use(named('metal.png')) });
  const input = (settings: Partial<ModelImportSettings> = {}, materials = [metal]): ModelMaterialsInput => ({
    format: 'fbx',
    slots: materials.map((material) => ({ key: material.name, name: material.name, material })),
    settings: { ...DEFAULT_IMPORT_SETTINGS, ...settings },
  });
  const side = (version: ModelMaterialsInput, path = 'Assets/Lantern/Lantern.fbx') => ({ sources: slotSources(version), request: assetsRequest(version, slotSources(version), path) });

  it('reads nothing for versions whose slots take the same materials and textures the same way', () => {
    expect(materialsMayDiffer(side(input()), side(input()))).toBe(false);
  });

  it('reads them when a remap, the material creation mode, a material of the file or the texture search changed', () => {
    expect(materialsMayDiffer(side(input()), side(input({ materialRemaps: [{ slot: 'Metal', guid: '0f2b6c1e9a8d4b3c8e7f6a5b4c3d2e1f' }] })))).toBe(true);
    expect(materialsMayDiffer(side(input()), side(input({ materialImport: 'none' })))).toBe(true);
    expect(materialsMayDiffer(side(input()), side(input({}, [fileMaterial('Metal', { alpha: 'blend' })])))).toBe(true);
    expect(materialsMayDiffer(side(input()), side(input({ searchTexturesGlobally: true })))).toBe(true);
  });

  it('reads them for a model moved, whose textures Unity searches from another folder', () => {
    expect(materialsMayDiffer(side(input()), side(input(), 'Assets/Props/Lantern.fbx'))).toBe(true);
  });
});

describe('materialChanges: textures the workspace lacks', () => {
  it('tells a texture a material now uses that the workspace lacks, never one it lacked already', () => {
    const gone = texture('gone.png', { id: 'gone.png', missing: true });
    const before = version({ Wood: { material: own('Wood'), baseMap: texture('planks.png') }, Cap: { material: own('Cap'), normalMap: gone } });
    const after = version({ Wood: { material: own('Wood'), baseMap: gone }, Cap: { material: own('Cap'), normalMap: gone } });
    expect(materialChanges(before, after)).toEqual([
      { kind: 'baseMap', slot: 'Wood', before: 'planks.png', after: 'gone.png' },
      { kind: 'textureMissing', slot: 'Wood', texture: 'gone.png' },
    ]);
  });

  it("tells a project material's texture the workspace lacks when the slot takes that material now", () => {
    const after = version({ Glass: { material: project('Lantern_Glass'), baseMap: texture("Glass's base map", { id: 'guid', missing: true }) } });
    expect(materialChanges(version({ Glass: { material: DEFAULT } }), after)).toEqual([
      { kind: 'source', slot: 'Glass', before: DEFAULT, after: project('Lantern_Glass') },
      { kind: 'textureMissing', slot: 'Glass', texture: "Glass's base map" },
    ]);
  });
});
