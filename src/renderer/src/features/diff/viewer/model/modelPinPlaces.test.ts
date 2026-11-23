import { Quaternion, Triangle, Vector3, type SkinnedMesh } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import type { ModelPin } from './modelAnnotations';
import { buildModelScene } from './modelScene';
import { nodeNamesOf } from './modelSpots';
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
 * `Tip`, halfway up, so turning `Tip` bends the top over as a sway does.
 */
function antenna(): ParsedModel {
  const model = testModel({
    nodes: [
      { name: 'Base', kind: 'bone' },
      { name: 'Tip', parent: 'Base', kind: 'bone', position: [0, 1, 0] },
      { name: 'Antenna', kind: 'skinnedMesh', mesh: { size: [0.2, 2, 0.2], center: [0, 1, 0], bones: ['Base', 'Tip'] } },
    ],
  });
  const { position, skinIndex } = model.meshes[0]!.attributes;
  for (let vertex = 0; vertex < position.length / 3; vertex++) skinIndex![vertex * 4] = position[vertex * 3 + 1]! > 1 ? 1 : 0;
  return model;
}

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
    expect(restReadsFor(tipPins(10))).toBe(restReadsFor(tipPins(1)));
  });

  it('anchors again only the pin whose spot changed: dragging one leaves the others be', () => {
    const after = drawn(antenna());
    const still = pin({ key: 'thread:1', spot: { ...onAntennaTip.spot } });
    const dragged = pin({ key: 'new:1', spot: { ...onAntennaTip.spot } });
    pinPlacesOf([still, dragged], { before: null, after });
    const moved = { ...dragged, spot: { point: { x: 0, y: 1.5, z: 0.1 }, node: { path: ['Antenna'], local: { x: 0, y: 1.5, z: 0.1 } } } };
    const { calls } = countCalls(Triangle.prototype, 'closestPointToPoint', () => pinPlacesOf([still, moved], { before: null, after }));
    // The box's 12 triangles, scanned once, for the one pin moved.
    expect(calls).toBe(12);
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
