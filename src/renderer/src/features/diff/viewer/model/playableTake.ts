// A take as the viewer can play it: only the tracks whose node and property its scene has. Three's `AnimationMixer`
// logs an error each time it binds a track it can't resolve, and the viewer builds no blendshapes (morph targets), so
// a take that animates a face's blendshapes (`<node>.morphTargetInfluences`, on a node that is a Group above the mesh)
// would fill the console while its bones play fine. Those tracks are left out before binding; the bones' stay.

import { AnimationClip, PropertyBinding, type KeyframeTrack, type Object3D } from 'three';

export interface PlayableTake {
  /** The take with only the tracks the scene can play. */
  clip: AnimationClip;
  /** The tracks left out: what `unplayableWords` tells. */
  dropped: KeyframeTrack[];
}

export function playableTake(take: AnimationClip, root: Object3D): PlayableTake {
  const kept: KeyframeTrack[] = [];
  const dropped: KeyframeTrack[] = [];
  for (const track of take.tracks) (canPlay(track, root) ? kept : dropped).push(track);
  return { clip: dropped.length === 0 ? take : new AnimationClip(take.name, take.duration, kept, take.blendMode), dropped };
}

/** One short line for the take bar when part of a take isn't played; null when all of it is. */
export function unplayableWords(dropped: KeyframeTrack[]): string | null {
  if (dropped.length === 0) return null;
  return dropped.some(isBlendshapeTrack) ? "Blendshape animation isn't shown" : "Part of this take isn't shown";
}

function canPlay(track: KeyframeTrack, root: Object3D): boolean {
  const path = PropertyBinding.parseTrackName(track.name);
  const node = PropertyBinding.findNode(root, path.nodeName);
  // A path through a sub-object (`.material`, `.bones[...]`) is left to the mixer: the loaders' takes key none.
  return node !== null && (Boolean(path.objectName) || Reflect.get(node, path.propertyName) !== undefined);
}

function isBlendshapeTrack(track: KeyframeTrack): boolean {
  return PropertyBinding.parseTrackName(track.name).propertyName === 'morphTargetInfluences';
}
