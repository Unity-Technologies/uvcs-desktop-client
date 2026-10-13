// A take as the viewer can play it: only the tracks whose node and property its scene has. Three's `AnimationMixer`
// logs an error each time it binds a track it can't resolve, so a track for a node the scene hasn't is left out before
// binding, and the rest still play. A blendshape track (`<node>.morphTargetInfluences`, whole as glTF keys it, or
// `[index]` as FBX does) names the mesh's node, which in the scene is a Group holding the mesh and its twins
// (`buildModelScene`): it is pointed at the mesh itself, by its uuid, whose twins share its weights. One on a node
// whose mesh has no blendshapes is left out.

import { AnimationClip, PropertyBinding, type KeyframeTrack, type Mesh } from 'three';
import type { ModelScene } from './modelScene';

export interface PlayableTake {
  /** The take with only the tracks the scene can play. */
  clip: AnimationClip;
  /** The tracks left out: what `unplayableWords` tells. */
  dropped: KeyframeTrack[];
}

export function playableTake(take: AnimationClip, scene: Pick<ModelScene, 'root' | 'meshes'>): PlayableTake {
  const kept: KeyframeTrack[] = [];
  const dropped: KeyframeTrack[] = [];
  let retargeted = false;
  for (const track of take.tracks) {
    if (isBlendshapeTrack(track)) {
      const onMeshes = blendshapeTracksOf(track, scene);
      if (onMeshes.length === 0) dropped.push(track);
      kept.push(...onMeshes);
      retargeted ||= onMeshes.length > 0;
    } else (canPlay(track, scene) ? kept : dropped).push(track);
  }
  const unchanged = dropped.length === 0 && !retargeted;
  return { clip: unchanged ? take : new AnimationClip(take.name, take.duration, kept, take.blendMode), dropped };
}

/** One short line for the take bar when part of a take isn't played; null when all of it is. */
export function unplayableWords(dropped: KeyframeTrack[]): string | null {
  if (dropped.length === 0) return null;
  return dropped.some(isBlendshapeTrack) ? "Blendshape animation isn't shown" : "Part of this take isn't shown";
}

function canPlay(track: KeyframeTrack, scene: Pick<ModelScene, 'root'>): boolean {
  const path = PropertyBinding.parseTrackName(track.name);
  const node = PropertyBinding.findNode(scene.root, path.nodeName);
  // A path through a sub-object (`.material`, `.bones[...]`) is left to the mixer: the loaders' takes key none.
  return node !== null && (Boolean(path.objectName) || Reflect.get(node, path.propertyName) !== undefined);
}

/** The track once for each mesh with blendshapes on the node it names, addressed to that mesh. */
function blendshapeTracksOf(track: KeyframeTrack, scene: Pick<ModelScene, 'root' | 'meshes'>): KeyframeTrack[] {
  const path = PropertyBinding.parseTrackName(track.name);
  const node = PropertyBinding.findNode(scene.root, path.nodeName);
  if (!node) return [];
  const index = path.propertyIndex === undefined ? '' : `[${path.propertyIndex}]`;
  return scene.meshes
    .map(({ solid }) => solid as Mesh)
    .filter((solid) => solid.parent === node && (solid.morphTargetInfluences?.length ?? 0) > 0)
    .map((solid) => {
      const onMesh = track.clone();
      onMesh.name = `${solid.uuid}.${path.propertyName}${index}`;
      return onMesh;
    });
}

function isBlendshapeTrack(track: KeyframeTrack): boolean {
  return PropertyBinding.parseTrackName(track.name).propertyName === 'morphTargetInfluences';
}
