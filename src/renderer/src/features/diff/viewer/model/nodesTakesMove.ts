// Which of a model's nodes a take moves: the only ones whose transform changes once its scene is built. Every other
// node keeps the matrix it was built with (`buildModelScene` turns three's `matrixAutoUpdate` off for it), so a frame
// doesn't compose thousands of matrices that never change: a model of 3,000 parts spent a fifth of each frame there.

import { PropertyBinding } from 'three';
import type { ModelClip } from './parsedModel';

/** The properties of a node that place it; a blendshape track (`morphTargetInfluences`) moves none. */
const TRANSFORMS = new Set(['position', 'quaternion', 'scale', 'rotation']);

/**
 * Whether a take moves the node of this name (as the scene names it, `PropertyBinding.sanitizeNodeName`, which is how
 * takes address their nodes). A track whose name can't be read, or that reaches a node through another
 * (`Armature.bones[Hip].position`), could move any node: then every node is taken as moved.
 */
export function nodesTakesMove(clips: readonly Pick<ModelClip, 'tracks'>[]): (nodeName: string) => boolean {
  const moved = new Set<string>();
  for (const clip of clips) {
    for (const track of clip.tracks.tracks) {
      const path = parsedTrackName(track.name);
      if (!path || (path.objectName && TRANSFORMS.has(path.propertyName))) return () => true;
      if (TRANSFORMS.has(path.propertyName)) moved.add(path.nodeName);
    }
  }
  return (nodeName) => moved.has(nodeName);
}

function parsedTrackName(name: string): ReturnType<typeof PropertyBinding.parseTrackName> | null {
  try {
    return PropertyBinding.parseTrackName(name);
  } catch {
    return null;
  }
}
