import { useEffect, useState } from 'react';
import { buildModelScene, type ModelScene } from './modelScene';
import type { ModelReadState } from './useReadModel';

type ReadyModel = Extract<ModelReadState, { status: 'ready' }>;

/**
 * The version's three.js scene, built once per version read and let go with it. Built in an effect, not a memo: a
 * memo's scene would be disposed by StrictMode's trial unmount while still on screen.
 */
export function useModelScene(read: ReadyModel | null): ModelScene | null {
  const [built, setBuilt] = useState<{ read: ReadyModel; scene: ModelScene } | null>(null);
  useEffect(() => {
    if (!read) return setBuilt(null);
    const scene = buildModelScene(read.model, read.summary);
    setBuilt({ read, scene });
    return () => scene.dispose();
  }, [read]);
  // Only this version's scene: the one before stays out while the next is built.
  return built && built.read === read ? built.scene : null;
}
