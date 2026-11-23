import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { fromThreeObject, type ModelFileFacts } from './fromThreeObject';

const FACTS = { format: 'glb', textures: [], materials: [], images: [], unitScale: 1, upAxis: 'y', axisConversion: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], exportedFrom: null, frameRate: null } as unknown as ModelFileFacts;

/** A node as GLTFLoader makes it: named uniquely for animation bindings, the file's own name in `userData.name`. */
function gltfNode(bound: string, fileName: string): Group {
  const node = new Group();
  node.name = bound;
  node.userData.name = fileName;
  return node;
}

describe('fromThreeObject', () => {
  it("keeps the file's own name of a node GLTFLoader renamed, which is what a comment's part names", () => {
    const root = new Group();
    const car = gltfNode('Car', 'Car');
    car.add(gltfNode('Wheel', 'Wheel'), gltfNode('Wheel_1', 'Wheel'), gltfNode('Hand_L', 'Hand L'));
    root.add(car);
    const { nodes } = fromThreeObject(root, [], FACTS);
    expect(nodes.map((node) => [node.name, node.fileName])).toEqual([
      ['', undefined],
      ['Car', undefined],
      ['Wheel', undefined],
      ['Wheel_1', 'Wheel'],
      ['Hand_L', 'Hand L'],
    ]);
  });
});
