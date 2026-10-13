import { describe, expect, it } from 'vitest';
import type { NeedState } from '../materials/materialPlan';
import type { TextureLoad } from './textureLoads';
import { needStatesOf, onlyLoaded } from './textureStates';

const load = (key: string): TextureLoad => ({ key, name: `${key}.png`, source: { kind: 'bytes', bytes: new Uint8Array(), id: key }, longest: 1024, flipY: false });
const ready = (key: string): NeedState => ({ kind: 'ready', key, bitmap: {} as ImageBitmap, opaque: true });

describe('texture states', () => {
  it("tells each need's state: decoded, loading, or failed for an image that doesn't read", () => {
    const loads = new Map([
      ['a', load('k1')],
      ['b', load('k2')],
      ['c', null],
    ]);
    expect(needStatesOf(loads, new Map([['k1', ready('k1')]]))).toEqual(
      new Map<string, NeedState>([
        ['a', ready('k1')],
        ['b', { kind: 'loading' }],
        ['c', { kind: 'failed', problem: 'unreadable' }],
      ]),
    );
  });

  it("keeps only the decodes the current loads use: another model's bitmaps are let go", () => {
    const decoded = new Map([
      ['k1', ready('k1')],
      ['old', ready('old')],
    ]);
    expect([...onlyLoaded(decoded, new Map([['a', load('k1')]])).keys()]).toEqual(['k1']);
    // Nothing to drop: the same map, so the view isn't drawn again for it.
    expect(onlyLoaded(decoded, new Map([['a', load('k1')], ['b', load('old')], ['c', load('k3')]]))).toBe(decoded);
  });
});
