import { describe, expect, it } from 'vitest';
import { objMaterialLibraries, readMtlMaterials } from './mtlMaterials';

describe('objMaterialLibraries', () => {
  it('names the .mtl files an OBJ uses, a name with spaces whole, CRLF or not', () => {
    expect(objMaterialLibraries(['# Blender', 'mtllib Old Barn.mtl', 'o Barn', 'v 0 0 0', 'usemtl Wood'].join('\r\n'))).toEqual(['Old Barn.mtl']);
    expect(objMaterialLibraries('mtllib a.mtl\nmtllib a.mtl\nmtllib b.mtl\n')).toEqual(['a.mtl', 'b.mtl']);
    expect(objMaterialLibraries('o Rock\nv 0 0 0\n')).toEqual([]);
  });
});

describe('readMtlMaterials', () => {
  it("reads each material's diffuse color as sRGB, its textures and their options", () => {
    const mtl = [
      '# Blender MTL File',
      'newmtl Wood',
      'Kd 1.000000 0.500000 0.000000',
      'd 1.0',
      'map_Kd -s 2 2 1 -o 0.5 0 Textures/wood planks.png',
      'map_Bump -bm 0.8 wood_n.png',
      '',
      'newmtl Glass',
      'Kd 0.8 0.9 1',
      'Tr 0.75',
    ].join('\r\n');
    const [wood, glass] = readMtlMaterials(mtl);
    expect(wood).toMatchObject({
      name: 'Wood',
      opacity: 1,
      alpha: 'opaque',
      baseMap: { texture: { kind: 'named', name: 'wood planks.png', storedPaths: ['Textures/wood planks.png'] }, repeat: [2, 2], offset: [0.5, 0] },
      normalMap: { texture: { kind: 'named', name: 'wood_n.png' }, repeat: [1, 1] },
    });
    expect(wood!.color.map((value) => Number(value.toFixed(3)))).toEqual([1, 0.214, 0]);
    expect(glass).toMatchObject({ name: 'Glass', opacity: 0.25, alpha: 'blend', baseMap: null, normalMap: null });
  });

  it('reads a Windows path as the texture, and a material with nothing set as white', () => {
    const [stone] = readMtlMaterials('newmtl Stone\nmap_Kd C:\\Art\\stone.tga\n');
    expect(stone).toMatchObject({ color: [1, 1, 1], baseMap: { texture: { name: 'stone.tga', storedPaths: ['C:\\Art\\stone.tga'] } } });
  });
});
