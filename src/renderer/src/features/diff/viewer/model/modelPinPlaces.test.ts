import { Quaternion, Triangle, Vector3, type SkinnedMesh } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import type { ModelPin } from './modelAnnotations';
import { buildModelScene } from './modelScene';
import { nodeNamesOf } from './modelSpots';
import { viewerSpaceOf } from './modelSpaces';
import { pinPlacesOf, revealedPin, spotOfHit } from './modelPinPlaces';
import { modelSummary } from './modelSummary';
import { parseModel } from './parseModel';
import { SKINNED_TOP_CORNER, skinnedGltf } from './testing/skinnedGltf';
import { testModel } from './testing/testModels';
import type { ParsedModel } from './parsedModel';
import type { Vector } from './orbitCamera';

const CAR = testModel({ nodes: [{ name: 'Car' }, { name: 'Body', parent: 'Car', mesh: { size: [4, 1.2, 1.8] }, position: [0, 1, 0] }] });

function drawn(model: ParsedModel) {
  const summary = modelSummary(model);
  return { model, summary, scene: buildModelScene(model, summary) };
}

const pin = (fields: Partial<ModelPin>): ModelPin => ({
  key: 'thread:1',
  side: 'after',
  spot: { point: { x: 0, y: 1.6, z: 0 }, node: { path: ['Car', 'Body'], local: { x: 0, y: 0.6, z: 0 } } },
  author: 'ana',
  tip: '',
  emphasized: true,
  earlier: false,
  movable: false,
  ...fields,
});

describe('pinPlacesOf', () => {
  it("places a pin on its part as drawn now, and names the part's node to light it", () => {
    const after = drawn(CAR);
    const [place] = pinPlacesOf([pin({})], { before: null, after });
    expect(place!.nodeKey).toBe('Car/Body');
    expect(place!.point()).toEqual([0, 1.6, 0]);
    // A take lifts the body: the pin goes with it.
    const body = after.scene.objects.get('Car/Body')!;
    body.position.y = 3;
    body.updateMatrix();
    after.scene.root.updateMatrixWorld(true);
    expect(place!.point()[1]).toBeCloseTo(3.6);
  });

  it("gives the box a part comment's part fills, and none for a comment on a point", () => {
    const after = drawn(CAR);
    const onPart = pin({ spot: { point: { x: 0, y: 1.6, z: 0 }, node: { path: ['Car', 'Body'], local: { x: 0, y: 0.6, z: 0 } }, wholePart: true } });
    const corners = pinPlacesOf([onPart], { before: null, after })[0]!.partCorners()!;
    expect(corners).toHaveLength(8);
    expect(Math.max(...corners.map((corner) => corner[0]))).toBeCloseTo(2);
    expect(pinPlacesOf([pin({})], { before: null, after })[0]!.partCorners()).toBeNull();
  });

  it('places a pin whose part is gone at its point, and says so', () => {
    const noBody = drawn(testModel({ nodes: [{ name: 'Car' }] }));
    const [place] = pinPlacesOf([pin({})], { before: null, after: noBody });
    expect(place).toMatchObject({ nodeKey: null, partGone: true });
    expect(place!.point()).toEqual([0, 1.6, 0]);
  });

  it('leaves out a pin on a version not shown', () => {
    expect(pinPlacesOf([pin({ side: 'before' })], { before: null, after: drawn(CAR) })).toEqual([]);
  });
});

/**
 * A car's roof antenna, 2 m tall, skinned to two bones: its lower half to `Base`, at its foot, and its upper half to
 * `Tip`, halfway up, so turning `Tip` bends the top over as a sway does. `inCentimeters`: written as 3ds Max writes
 * it, in centimeters with Z up, its own Y still along its length.
 */
function antenna({ inCentimeters = false } = {}): ParsedModel {
  const unit = inCentimeters ? 100 : 1;
  const model = testModel({
    ...(inCentimeters && { unitScale: 0.01, upAxis: 'z' as const }),
    nodes: [
      { name: 'Base', kind: 'bone' },
      { name: 'Tip', parent: 'Base', kind: 'bone', position: [0, unit, 0] },
      { name: 'Antenna', kind: 'skinnedMesh', mesh: { size: [0.2 * unit, 2 * unit, 0.2 * unit], center: [0, unit, 0], bones: ['Base', 'Tip'], blendShapes: ['Lean'] } },
    ],
  });
  const { position, skinIndex } = model.meshes[0]!.attributes;
  for (let vertex = 0; vertex < position.length / 3; vertex++) skinIndex![vertex * 4] = position[vertex * 3 + 1]! > unit ? 1 : 0;
  return model;
}

/** Gives the model's first mesh's blendshape `name` an offset for every vertex of its top half. */
function liftTop(model: ParsedModel, name: string, offset: Vector): void {
  const { attributes, blendShapes } = model.meshes[0]!;
  const top = Math.max(...attributes.position.filter((_, i) => i % 3 === 1));
  const deltas = blendShapes.find((shape) => shape.name === name)!.deltas;
  for (let vertex = 0; vertex < attributes.position.length / 3; vertex++) {
    if (attributes.position[vertex * 3 + 1]! > top / 2) deltas.set(offset, vertex * 3);
  }
}

/** A point in the file's space as the viewer draws it. */
const inViewer = (model: ParsedModel, point: Vector): Vector => close(new Vector3(...point).applyMatrix4(viewerSpaceOf(model)).toArray() as Vector) as Vector;

/** Turns the antenna's `Tip` a quarter turn about Z, bending its top to -X, and places it as a frame does. */
function sway(version: ReturnType<typeof drawn>): void {
  const tip = version.scene.objects.get('Base/Tip')!;
  tip.quaternion.copy(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
  tip.updateMatrix();
  version.scene.root.updateMatrixWorld(true);
}

/** Counts the reads of the model's first mesh's positions from here on: how often the mesh is placed at rest. */
function countPositionReads(model: ParsedModel): () => number {
  let reads = 0;
  const attributes = model.meshes[0]!.attributes;
  attributes.position = new Proxy(attributes.position, {
    get(target, property) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads++;
      const value: unknown = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return () => reads;
}

const onAntennaTip = pin({ spot: { point: { x: 0, y: 2, z: 0 }, node: { path: ['Antenna'], local: { x: 0, y: 2, z: 0 } } } });
const close = (vector: Vector) => vector.map((value) => Number(value.toFixed(5)) + 0);
const closePoint = ({ x, y, z }: { x: number; y: number; z: number }) => close([x, y, z]);

describe('pinPlacesOf, a skinned mesh', () => {
  it("follows the skin as the bones bend it, though the mesh's node stays where it is", () => {
    const after = drawn(antenna());
    const [place] = pinPlacesOf([onAntennaTip], { before: null, after });
    expect(close(place!.point())).toEqual([0, 2, 0]);
    sway(after);
    expect(close(place!.point())).toEqual([-1, 1, 0]);
  });

  it('anchors where the point is at rest, whatever pose a take holds when the pins arrive', () => {
    const after = drawn(antenna());
    sway(after);
    const [place] = pinPlacesOf([onAntennaTip], { before: null, after });
    expect(close(place!.point())).toEqual([-1, 1, 0]);
  });

  it('reads three vertices a frame, however many the mesh has', () => {
    const after = drawn(antenna());
    const [place] = pinPlacesOf([onAntennaTip], { before: null, after });
    expect(countCalls(after.scene.meshes[0]!.solid as unknown as SkinnedMesh, 'getVertexPosition', () => place!.point()).calls).toBe(3);
  });

  it('skins the part at rest once, however many pins it holds', () => {
    const tipPins = (count: number) => Array.from({ length: count }, (_, i) => pin({ key: `thread:${i}`, spot: { ...onAntennaTip.spot } }));
    const restReadsFor = (pins: ModelPin[]) => {
      const after = drawn(antenna());
      const reads = countPositionReads(after.model);
      pinPlacesOf(pins, { before: null, after });
      return reads();
    };
    // Placed once: the box's 36 vertices, three coordinates each, each on one bone.
    expect(restReadsFor(tipPins(1))).toBe(108);
    expect(restReadsFor(tipPins(10))).toBe(108);
  });

  it('anchors again only the pin whose spot changed: dragging one leaves the others be', () => {
    const after = drawn(antenna());
    const still = pin({ key: 'thread:1', spot: { ...onAntennaTip.spot } });
    const dragged = pin({ key: 'new:1', spot: { ...onAntennaTip.spot } });
    pinPlacesOf([still, dragged], { before: null, after });
    const moved = { ...dragged, spot: { point: { x: 0, y: 1.5, z: 0.1 }, node: { path: ['Antenna'], local: { x: 0, y: 1.5, z: 0.1 } } } };
    const restReads = countPositionReads(after.model);
    const { calls } = countCalls(Triangle.prototype, 'closestPointToPoint', () => pinPlacesOf([still, moved], { before: null, after }));
    // The part isn't placed at rest again: it was for the first set.
    expect(restReads()).toBe(0);
    // The box's 12 triangles, scanned once, for the one pin moved.
    expect(calls).toBe(12);
  });

  it("follows the skin of a model in centimeters with Z up, carried into the viewer's units and axes", () => {
    const model = antenna({ inCentimeters: true });
    const after = drawn(model);
    const onTip = pin({ spot: { point: { x: 0, y: 200, z: 0 }, node: { path: ['Antenna'], local: { x: 0, y: 200, z: 0 } } } });
    const [place] = pinPlacesOf([onTip], { before: null, after });
    expect(close(place!.point())).toEqual(inViewer(model, [0, 200, 0]));
    sway(after);
    expect(close(place!.point())).toEqual(inViewer(model, [-100, 100, 0]));
  });

  it('follows a blendshape a take sets on the skin', () => {
    const model = antenna();
    liftTop(model, 'Lean', [0.5, 0, 0]);
    const after = drawn(model);
    const [place] = pinPlacesOf([onAntennaTip], { before: null, after });
    after.scene.meshes[0]!.solid.morphTargetInfluences![0] = 1;
    expect(close(place!.point())).toEqual([0.5, 2, 0]);
  });

  it('follows a blendshape on a rigid mesh too, which its node alone would leave behind', () => {
    const model = testModel({ nodes: [{ name: 'Lid', mesh: { blendShapes: ['Open'] }, position: [0, 1, 0] }] });
    liftTop(model, 'Open', [0, 1, 0]);
    const after = drawn(model);
    const onLid = pin({ spot: { point: { x: 0, y: 1.5, z: 0 }, node: { path: ['Lid'], local: { x: 0, y: 0.5, z: 0 } } } });
    const [place] = pinPlacesOf([onLid], { before: null, after });
    expect(close(place!.point())).toEqual([0, 1.5, 0]);
    after.scene.meshes[0]!.solid.morphTargetInfluences![0] = 1;
    expect(close(place!.point())).toEqual([0, 2.5, 0]);
  });

  describe('a glTF, whose skinned mesh its node places nothing of', () => {
    // GLTFLoader reads `self.URL`, and its FileLoader reports progress with `ProgressEvent`: globals a page has and Node hasn't.
    beforeEach(() => {
      vi.stubGlobal('self', globalThis);
      vi.stubGlobal('ProgressEvent', class extends Event {});
    });
    afterEach(() => vi.unstubAllGlobals());

    it('follows the joint that carries it', async () => {
      const read = await parseModel({ bytes: new TextEncoder().encode(skinnedGltf()), format: 'gltf' });
      if (read.kind !== 'parsed') throw new Error('Not parsed');
      const after = drawn(read.model);
      const body = read.model.meshes[0]!;
      const top = Array.from(body.attributes.position.slice(SKINNED_TOP_CORNER * 3, SKINNED_TOP_CORNER * 3 + 3));
      const onTop = pin({ spot: { point: { x: 0, y: 0, z: 180 }, node: { path: nodeNamesOf(read.model.nodes, body.node), local: { x: top[0]!, y: top[1]!, z: top[2]! } } } });
      const [place] = pinPlacesOf([onTop], { before: null, after });
      expect(close(place!.point())).toEqual([0, 1.8, 0]);
      // The hips step 50 cm along X: the whole body, and the pin on its top, with them.
      const hips = after.scene.objects.get(after.summary.nodes[body.skin!.bones[0]!]!.key)!;
      hips.position.x += 50;
      hips.updateMatrix();
      after.scene.root.updateMatrixWorld(true);
      expect(close(place!.point())).toEqual([0.5, 1.8, 0]);
    });

    it("writes a point hit mid-pose in the file's units where it rests, and places it back under the hit", async () => {
      const read = await parseModel({ bytes: new TextEncoder().encode(skinnedGltf()), format: 'gltf' });
      if (read.kind !== 'parsed') throw new Error('Not parsed');
      const after = drawn(read.model);
      const body = read.model.meshes[0]!;
      // The hips bow a quarter turn: the top corner swings down from 1.8 m up to 1 m up.
      const hips = after.scene.objects.get(after.summary.nodes[body.skin!.bones[0]!]!.key)!;
      hips.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
      hips.updateMatrix();
      after.scene.root.updateMatrixWorld(true);
      const solid = after.scene.meshes[0]!.solid as unknown as SkinnedMesh;
      const hit = solid.getVertexPosition(SKINNED_TOP_CORNER, new Vector3()).applyMatrix4(solid.matrixWorld).toArray() as Vector;
      expect(close(hit)[1]).toBeCloseTo(1);
      const spot = spotOfHit(after, { key: after.summary.nodes[body.node]!.key, point: hit }, [0, 1, 5], false)!;
      // Where it rests, in the file's space (the loader's meters), and in the body's own (centimeters, Z up).
      expect(closePoint(spot.point)).toEqual([0, 1.8, 0]);
      expect(spot.node!.local).toEqual({ x: expect.closeTo(0, 3), y: expect.closeTo(0, 3), z: expect.closeTo(180, 3) });
      const [place] = pinPlacesOf([pin({ spot })], { before: null, after });
      expect(close(place!.point())).toEqual(close(hit));
    });
  });
});

describe('spotOfHit', () => {
  it("writes the spot of the point hit on a part, in its space, with the camera", () => {
    const spot = spotOfHit(drawn(CAR), { key: 'Car/Body', point: [0, 1.6, 0] }, [0, 1.6, 5], true)!;
    expect(spot).toMatchObject({ node: { path: ['Car', 'Body'] }, wholePart: true, view: { direction: { x: 0, y: 0, z: 1 }, distance: 5 } });
    expect(spot.point.y).toBeCloseTo(1.6);
    expect(spot.node!.local!.y).toBeCloseTo(0.6);
  });

  it('writes a point hit on a skinned mesh a take bends where that place on it is at rest', () => {
    const after = drawn(antenna());
    sway(after);
    const spot = spotOfHit(after, { key: 'Antenna', point: [-1, 1, 0] }, [-1, 1, 5], false)!;
    expect(closePoint(spot.point)).toEqual([0, 2, 0]);
    expect(closePoint(spot.node!.local!)).toEqual([0, 2, 0]);
    // The camera stays as its author saw the bent antenna.
    expect(spot.view).toEqual({ direction: { x: 0, y: 0, z: 1 }, distance: 5 });
  });

  it("writes a point hit mid-pose on a skinned mesh in centimeters with Z up where it rests, in the file's units", () => {
    const model = antenna({ inCentimeters: true });
    const after = drawn(model);
    sway(after);
    const spot = spotOfHit(after, { key: 'Antenna', point: inViewer(model, [-100, 100, 0]) }, inViewer(model, [-100, 100, 500]), false)!;
    expect(closePoint(spot.point)).toEqual([0, 200, 0]);
    expect(closePoint(spot.node!.local!)).toEqual([0, 200, 0]);
  });

  it('marks nothing where nothing was hit', () => {
    expect(spotOfHit(drawn(CAR), { key: null, point: null }, [0, 0, 5], false)).toBeNull();
  });
});

describe('revealedPin', () => {
  const versions = () => ({ before: null, after: drawn(CAR) });
  const reveal = { key: 'thread:1', seq: 2 };

  it('shows the pin asked for, on the version it is on', () => {
    const shown = revealedPin(reveal, null, true, [pin({})], versions());
    expect(shown?.pin.key).toBe('thread:1');
    expect(shown?.place.point()).toEqual([0, 1.6, 0]);
  });

  it('waits for the framing, and for the pins when they arrive after it', () => {
    expect(revealedPin(reveal, null, false, [pin({})], versions())).toBeNull();
    expect(revealedPin(reveal, null, true, [], versions())).toBeNull();
    expect(revealedPin(reveal, null, true, [pin({})], versions())).not.toBeNull();
  });

  it('shows each reveal once, and none for a pin on a version not shown', () => {
    expect(revealedPin(reveal, 2, true, [pin({})], versions())).toBeNull();
    expect(revealedPin(null, null, true, [pin({})], versions())).toBeNull();
    expect(revealedPin(reveal, null, true, [pin({ side: 'before' })], versions())).toBeNull();
  });
});
