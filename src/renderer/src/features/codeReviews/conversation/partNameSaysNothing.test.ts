import { describe, expect, it } from 'vitest';
import { partNameSaysNothing } from './partNameSaysNothing';

describe('partNameSaysNothing', () => {
  it('reads the names exporters give a part nobody named as saying nothing', () => {
    for (const name of ['Mesh', 'mesh', 'Object_12', 'mesh_0', 'polySurface3', 'node_5', 'Cube.001', 'Plane.012', 'pCube1', 'pCylinder3', 'Geometry', 'Group 2', 'default', 'RootNode', 'Scene', '12', '', '  ']) {
      expect(partNameSaysNothing(name), name).toBe(true);
    }
  });

  it('keeps a name a person gave, even one with a generic word or a number in it', () => {
    for (const name of ['Wheel', 'Wheel_FL', 'Board', 'Door_Panel', 'WheelMesh', 'Mesh_Wheel', 'Object of desire', 'Cubes', 'Plane', 'Sphere', 'Cylinder_3', 'Cube', 'Antenna2', 'Rueda delantera', '車輪_1', 'Ñandú']) {
      expect(partNameSaysNothing(name), name).toBe(false);
    }
  });

  it('answers at once for a long run of digits before a name', () => {
    expect(partNameSaysNothing('1'.repeat(10_000) + '_LOD')).toBe(false);
  });
});
