import { useEffect, useMemo, useState } from 'react';
import type { NeedState } from '../materials/materialPlan';
import { loadTexture, type TextureLoad } from './textureLoads';
import { needStatesOf, onlyLoaded } from './textureStates';

/** Each need's texture as it decodes (`loadTexture`); the ones decoded before show at once. */
export function useTextureStates(workspacePath: string, loads: Map<string, TextureLoad | null>): Map<string, NeedState> {
  const [decoded, setDecoded] = useState<ReadonlyMap<string, NeedState>>(new Map());
  useEffect(() => {
    let live = true;
    // The bitmaps of loads no longer asked for go: the decode cache keeps what it may.
    setDecoded((current) => onlyLoaded(current, loads));
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
  return useMemo(() => needStatesOf(loads, decoded), [loads, decoded]);
}
