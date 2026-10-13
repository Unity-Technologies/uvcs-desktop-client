import type { NeedState } from '../materials/materialPlan';
import type { TextureLoad } from './textureLoads';

/** Each need's state: its decode once there, loading until then; an image that doesn't read failed. */
export function needStatesOf(loads: ReadonlyMap<string, TextureLoad | null>, decoded: ReadonlyMap<string, NeedState>): Map<string, NeedState> {
  const states = new Map<string, NeedState>();
  for (const [need, load] of loads) states.set(need, load ? (decoded.get(load.key) ?? { kind: 'loading' }) : { kind: 'failed', problem: 'unreadable' });
  return states;
}

/** The decodes the loads use, by key: a model left behind lets its bitmaps go (the decode cache keeps what it may). */
export function onlyLoaded(decoded: ReadonlyMap<string, NeedState>, loads: ReadonlyMap<string, TextureLoad | null>): ReadonlyMap<string, NeedState> {
  const keys = new Set([...loads.values()].flatMap((load) => (load ? [load.key] : [])));
  const kept = [...decoded].filter(([key]) => keys.has(key));
  // The same map when nothing goes: React then doesn't draw the view again for it.
  return kept.length === decoded.size ? decoded : new Map(kept);
}
