import { describe, expect, it } from 'vitest';
import type { FileMaterial, ParsedModel } from '../parsedModel';
import { testModel } from '../testing/testModels';
import { fileMaterialChanges } from './fileMaterialChanges';
import { fileMaterial, named, use } from './testing/testMaterials';

/** A robot: its body and its joints, each in a slot named as the material given (`Main`, `Grey`). */
function robot(main: FileMaterial, grey: FileMaterial = fileMaterial('Grey'), format: ParsedModel['format'] = 'glb'): ParsedModel {
  return {
    ...testModel({
      nodes: [
        { name: 'Body', mesh: { slots: [main.name], materials: [0] } },
        { name: 'Joints', mesh: { slots: [grey.name], materials: [1] } },
      ],
      materials: [main, grey],
    }),
    format,
  };
}

describe('fileMaterialChanges', () => {
  it("tells a slot's base color repainted, as the Inspector shows it", () => {
    const orange = fileMaterial('Main', { color: [0.59, 0.291, 0.038] });
    const blue = fileMaterial('Main', { color: [0.04, 0.22, 0.75] });
    expect(fileMaterialChanges(robot(orange), robot(blue))).toEqual([{ kind: 'baseColor', slot: 'Main', before: '#CA9337', after: '#3881E1' }]);
    expect(fileMaterialChanges(robot(orange), robot(orange))).toEqual([]);
  });

  it("tells a glTF's color under its base map, which tints it, and not an FBX's, which Unity drops", () => {
    const tinted = (color: [number, number, number]) => fileMaterial('Main', { color, baseMap: use(named('robot.png')) });
    expect(fileMaterialChanges(robot(tinted([1, 1, 1])), robot(tinted([1, 0, 0])))).toMatchObject([{ kind: 'baseColor', slot: 'Main' }]);
    expect(fileMaterialChanges(robot(tinted([1, 1, 1]), undefined, 'fbx'), robot(tinted([1, 0, 0]), undefined, 'fbx'))).toEqual([]);
  });

  it('tells alpha, cutoff, opacity, sides and tiling, leaving which textures to the textures the model names', () => {
    const glass = fileMaterial('Grey', { alpha: 'blend', opacity: 0.5, baseMap: use(named('glass.png')) });
    const clearer = fileMaterial('Grey', { alpha: 'blend', opacity: 0.25, doubleSided: true, baseMap: { ...use(named('glass.png')), repeat: [2, 2] } });
    expect(fileMaterialChanges(robot(fileMaterial('Main'), glass), robot(fileMaterial('Main'), clearer))).toEqual([
      { kind: 'opacity', slot: 'Grey', before: 0.5, after: 0.25 },
      { kind: 'doubleSided', slot: 'Grey', now: true },
      { kind: 'tiling', slot: 'Grey', before: { repeat: [1, 1], offset: [0, 0] }, after: { repeat: [2, 2], offset: [0, 0] } },
    ]);
    const leaves = (alpha: FileMaterial['alpha'], cutoff = 0.5) => fileMaterial('Main', { alpha, cutoff });
    expect(fileMaterialChanges(robot(leaves('clip', 0.5)), robot(leaves('clip', 0.3)))).toEqual([{ kind: 'cutoff', slot: 'Main', before: 0.5, after: 0.3 }]);
    expect(fileMaterialChanges(robot(leaves('opaque')), robot(leaves('clip')))).toEqual([{ kind: 'alpha', slot: 'Main', before: 'opaque', after: 'clip' }]);
    expect(fileMaterialChanges(robot(fileMaterial('Main', { baseMap: use(named('a.png')) })), robot(fileMaterial('Main', { baseMap: use(named('b.png')) })))).toEqual([]);
  });

  it('pairs slots by name only: an unnamed material, or a slot only one version has, tells nothing', () => {
    const unnamed = (color: [number, number, number]) => robot(fileMaterial('', { color }));
    expect(fileMaterialChanges(unnamed([1, 1, 1]), unnamed([0, 0, 1]))).toEqual([]);
    expect(fileMaterialChanges(robot(fileMaterial('Main')), robot(fileMaterial('Paint', { color: [1, 0, 0] })))).toEqual([]);
  });
});
