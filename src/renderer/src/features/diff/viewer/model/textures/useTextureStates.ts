import { useEffect, useMemo, useState } from 'react';
import type { NeedState } from '../materials/materialPlan';
import { loadTexture, type TextureLoad } from './textureLoads';

/** Each need's texture as it decodes (`loadTexture`); the ones decoded before show at once. */
export function useTextureStates(workspacePath: string, loads: Map<string, TextureLoad | null>): Map<string, NeedState> {
  const [decoded, setDecoded] = useState<ReadonlyMap<string, NeedState>>(new Map());
  useEffect(() => {
    let live = true;
    for (const load of loads.values()) {
      if (!load) continue;
      void loadTexture(workspacePath, load).then((result) => {
        if (!live) return;
        const state: NeedState = result.kind === 'decoded' ? { kind: 'ready', key: load.key, bitmap: result.bitmap } : { kind: 'failed', problem: result.problem };
        setDecoded((current) => new Map(current).set(load.key, state));
      });
    }
    return () => {
      live = false;
    };
  }, [workspacePath, loads]);
  return useMemo(() => {
    const states = new Map<string, NeedState>();
    for (const [need, load] of loads) states.set(need, load ? (decoded.get(load.key) ?? { kind: 'loading' }) : { kind: 'failed', problem: 'unreadable' });
    return states;
  }, [loads, decoded]);
}
