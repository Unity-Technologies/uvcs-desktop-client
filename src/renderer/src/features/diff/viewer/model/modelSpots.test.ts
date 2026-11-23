import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import { viewerSpaceOf, worldMatricesOf } from './modelSpaces';
import { nodeNamesOf, nodeOfSpot, placedSpot, spotOfPick } from './modelSpots';
import type { Vector } from './orbitCamera';
import type { ParsedModel } from './parsedModel';
import { testModel } from './testing/testModels';

/** A car in centimetres, Z up as 3ds Max exports: its body, and two wheels that share a name, one each side. */
const CAR_SPEC = {
  root: 'Car.fbx',
  unitScale: 0.01,
  upAxis: 'z' as const,
  nodes: [
    { name: 'Car' },
    { name: 'Body', parent: 'Car', mesh: { size: [400, 180, 120] as [number, number, number] }, position: [0, 0, 60] as [number, number, number] },
    { name: 'Wheel', parent: 'Car', mesh: { size: [60, 30, 60] as [number, number, number] }, position: [150, 90, 30] as [number, number, number] },
    { name: 'Wheel', parent: 'Car', mesh: { size: [60, 30, 60] as [number, number, number] }, position: [150, -90, 30] as [number, number, number] },
  ],
};

const CAR = testModel(CAR_SPEC);

/** Each node's matrix to the viewer's space at rest, as a version is drawn before a take moves it. */
function restWorld(model: ParsedModel): (index: number) => Matrix4 {
  const matrices = worldMatricesOf(model, viewerSpaceOf(model));
  return (index) => matrices[index]!;
}

const close = (vector: Vector) => vector.map((value) => Number(value.toFixed(6)) + 0);
const closePoint = ({ x, y, z }: { x: number; y: number; z: number }) => close([x, y, z]);

describe('nodeNamesOf', () => {
  it("names a node from under the model's root down to it", () => {
    expect(nodeNamesOf(CAR.nodes, 0)).toEqual([]);
    expect(nodeNamesOf(CAR.nodes, 2)).toEqual(['Car', 'Body']);
    expect(nodeNamesOf(CAR.nodes, 4)).toEqual(['Car', 'Wheel']);
  });
});

describe('spotOfPick', () => {
  const viewerSpace = viewerSpaceOf(CAR);
  const onBody = (local: [number, number, number]) => new Vector3(...local).applyMatrix4(restWorld(CAR)(2)).toArray() as Vector;

  it("writes the point in the file's space, the part's names and the point in the part's space", () => {
    const spot = spotOfPick(CAR, { point: onBody([10, 0, 60]), node: 2, camera: [0, 0, 10] }, restWorld(CAR), viewerSpace);
    expect(closePoint(spot.point)).toEqual([10, 0, 120]);
    expect(spot.node?.path).toEqual(['Car', 'Body']);
    expect(closePoint(spot.node!.local!)).toEqual([10, 0, 60]);
    expect(spot.wholePart).toBeUndefined();
  });

  it('writes the camera as a direction from the point and a distance, in the file’s units', () => {
    // The camera 2 m above the point in the viewer's space (Y up, metres): 200 cm along the file's Z (up there).
    const point = onBody([10, 0, 60]);
    const spot = spotOfPick(CAR, { point, node: 2, camera: [point[0], point[1] + 2, point[2]] }, restWorld(CAR), viewerSpace);
    expect(closePoint(spot.view!.direction)).toEqual([0, 0, 1]);
    expect(spot.view!.distance).toBeCloseTo(200);
  });

  it('marks a comment on the whole part', () => {
    expect(spotOfPick(CAR, { point: onBody([0, 0, 60]), node: 2, camera: [0, 0, 10] }, restWorld(CAR), viewerSpace, true).wholePart).toBe(true);
  });

  it('writes the point where the part rests while a take moves it, and the same point on the part', () => {
    // The body lifted 1 m by a take as it's clicked.
    const posed = (index: number) => (index === 2 ? new Matrix4().makeTranslation(0, 1, 0).multiply(restWorld(CAR)(2)) : restWorld(CAR)(index));
    const point = new Vector3(10, 0, 60).applyMatrix4(posed(2)).toArray() as Vector;
    const spot = spotOfPick(CAR, { point, node: 2, camera: [0, 0, 10] }, posed, viewerSpace);
    expect(closePoint(spot.point)).toEqual([10, 0, 120]);
    expect(closePoint(spot.node!.local!)).toEqual([10, 0, 60]);
  });

  it('writes only the point where nothing names the part', () => {
    const spot = spotOfPick(CAR, { point: [1, 0, 0], node: null, camera: [1, 0, 3] }, restWorld(CAR), viewerSpace);
    expect(spot.node).toBeUndefined();
    expect(closePoint(spot.point)).toEqual([100, 0, 0]);
  });
});

describe('nodeOfSpot', () => {
  const onWheel = (point: [number, number, number]): ModelSpot => ({ point: { x: point[0], y: point[1], z: point[2] }, node: { path: ['Car', 'Wheel'], local: { x: 0, y: 0, z: 0 } } });

  it('finds the part by its names', () => {
    expect(nodeOfSpot(CAR, { point: { x: 0, y: 0, z: 0 }, node: { path: ['Car', 'Body'] } })).toBe(2);
  });

  it('tells siblings that share a name apart by where the point was written', () => {
    expect(nodeOfSpot(CAR, onWheel([150, 90, 30]))).toBe(3);
    expect(nodeOfSpot(CAR, onWheel([150, -90, 30]))).toBe(4);
  });

  it('finds none for a spot that names no part, or a part this version hasn’t', () => {
    expect(nodeOfSpot(CAR, { point: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(nodeOfSpot(CAR, { point: { x: 0, y: 0, z: 0 }, node: { path: ['Car', 'Spoiler'] } })).toBeNull();
    expect(nodeOfSpot(CAR, { point: { x: 0, y: 0, z: 0 }, node: { path: ['Body'] } })).toBeNull();
  });
});

describe('placedSpot', () => {
  const viewerSpace = viewerSpaceOf(CAR);
  const written = spotOfPick(CAR, { point: new Vector3(10, 0, 60).applyMatrix4(restWorld(CAR)(2)).toArray() as Vector, node: 2, camera: [0, 0, 10] }, restWorld(CAR), viewerSpace);

  it('shows a spot where it was written, on the version it was written on', () => {
    const { point, partGone } = placedSpot(written, nodeOfSpot(CAR, written), restWorld(CAR), viewerSpace);
    expect(close(point)).toEqual(close(new Vector3(10, 0, 60).applyMatrix4(restWorld(CAR)(2)).toArray() as Vector));
    expect(partGone).toBe(false);
  });

  it('follows its part to where another version has it', () => {
    const raised = testModel({ ...CAR_SPEC, nodes: CAR_SPEC.nodes.map((node) => (node.name === 'Body' ? { ...node, position: [0, 0, 160] } : node)) });
    const { point } = placedSpot(written, nodeOfSpot(raised, written), restWorld(raised), viewerSpaceOf(raised));
    // 1 m higher: the body moved up 100 cm along the file's Z, the viewer's Y.
    expect(point[1]).toBeCloseTo(1 + (120 * 0.01));
  });

  it("stays at its point, its part gone, on a version without the part", () => {
    const noBody = testModel({ ...CAR_SPEC, nodes: CAR_SPEC.nodes.filter((node) => node.name !== 'Body') });
    const { point, partGone } = placedSpot(written, nodeOfSpot(noBody, written), restWorld(noBody), viewerSpaceOf(noBody));
    expect(partGone).toBe(true);
    expect(close(point)).toEqual(close(new Vector3(10, 0, 120).applyMatrix4(viewerSpace).toArray() as Vector));
  });

  it('places a spot that names no part at its point', () => {
    const { point, partGone } = placedSpot({ point: { x: 100, y: 0, z: 0 } }, null, restWorld(CAR), viewerSpace);
    expect(close(point)).toEqual([1, 0, 0]);
    expect(partGone).toBe(false);
  });
});
