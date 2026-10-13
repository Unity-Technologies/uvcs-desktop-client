import { describe, expect, it } from 'vitest';
import { slotKeysOf } from './slotKeys';

describe('slotKeysOf', () => {
  it("keys an FBX's or OBJ's slots by name, as Unity matches its remaps and an OBJ's .mtl", () => {
    expect(slotKeysOf('fbx', { slots: ['Bark', 'Bark'], slotMaterials: [0, 1] })).toEqual(['Bark', 'Bark']);
    expect(slotKeysOf('obj', { slots: ['Brick'], slotMaterials: [-1] })).toEqual(['Brick']);
  });

  it("keys a glTF's slots by material, its unnamed materials apart", () => {
    expect(slotKeysOf('gltf', { slots: ['', ''], slotMaterials: [0, 3] })).toEqual(['#0', '#3']);
    expect(slotKeysOf('glb', { slots: ['Paint'], slotMaterials: [-1] })).toEqual(['Paint']);
  });
});
