import { describe, expect, it } from 'vitest';
import type { ModelPin } from './modelAnnotations';
import { buildModelScene } from './modelScene';
import { pinPlacesOf, spotOfHit } from './modelPinPlaces';
import { modelSummary } from './modelSummary';
import { testModel } from './testing/testModels';
import type { ParsedModel } from './parsedModel';

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

describe('spotOfHit', () => {
  it("writes the spot of the point hit on a part, in its space, with the camera", () => {
    const spot = spotOfHit(drawn(CAR), { key: 'Car/Body', point: [0, 1.6, 0] }, [0, 1.6, 5], true)!;
    expect(spot).toMatchObject({ node: { path: ['Car', 'Body'] }, wholePart: true, view: { direction: { x: 0, y: 0, z: 1 }, distance: 5 } });
    expect(spot.point.y).toBeCloseTo(1.6);
    expect(spot.node!.local!.y).toBeCloseTo(0.6);
  });

  it('marks nothing where nothing was hit', () => {
    expect(spotOfHit(drawn(CAR), { key: null, point: null }, [0, 0, 5], false)).toBeNull();
  });
});
