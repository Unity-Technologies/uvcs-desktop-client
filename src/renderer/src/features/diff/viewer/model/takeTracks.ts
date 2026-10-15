// What a take keys, track by track, as plain fingerprints: enough for `modelChanges` to tell a take whose keys changed
// at the same name and length (a run made bouncier) and which nodes it moves differently, without keeping both
// versions' keys. Computed with the summary, in the model worker.

import { PropertyBinding } from 'three';
import type { ModelClip, ParsedModel } from './parsedModel';
import { fingerprintOf } from './uniqueVertices';

export interface TakeTrack {
  /** As the loader names it: `<node>.<property>` (`Leg_L.quaternion`). */
  name: string;
  /** The node it keys, by its summary key; null when the model has no node of that name. */
  node: string | null;
  /** Its times and values in steps of `KEY_STEP`: a re-export's float noise weighs nothing. */
  keys: string;
}

/** Below this, a time (in seconds) or a value (a quaternion's part, a position in the file's units) is rounding. */
const KEY_STEP = 1e-4;

/**
 * Each track of the take. Its node is found by the name three's loaders give a track (`PropertyBinding`'s sanitized
 * name: `Leg L` is `Leg_L`), the first node of that name; `nodeKeys` are the summary's keys, in the model's order. A
 * blendshape track keyed whole, as glTF keys every weight of a mesh at once, is one track per blendshape, by its name:
 * a blendshape added to the mesh adds a weight to every take's keys, which changes none of them. A weight that stays
 * 0 moves nothing, and is no track.
 */
export function takeTracksOf(clip: ModelClip, model: Pick<ParsedModel, 'nodes' | 'meshes'>, nodeKeys: readonly string[]): TakeTrack[] {
  const indexOfName = new Map<string, number>();
  model.nodes.forEach((node, i) => {
    const name = PropertyBinding.sanitizeNodeName(node.name);
    if (!indexOfName.has(name)) indexOfName.set(name, i);
  });
  return clip.tracks.tracks.flatMap((track) => {
    const path = parsedTrackName(track.name);
    const index = path ? indexOfName.get(path.nodeName) : undefined;
    const node = index === undefined ? null : nodeKeys[index]!;
    const keyed = (name: string, values: readonly number[]): TakeTrack[] => {
      const steps = inKeySteps(values);
      if (path?.propertyName === 'morphTargetInfluences' && steps.every((step) => step === 0)) return [];
      return [{ name, node, keys: fingerprintOf(Int32Array.from([...inKeySteps(track.times), ...steps])) }];
    };
    if (path?.propertyName !== 'morphTargetInfluences' || path.propertyIndex !== undefined || track.times.length === 0) return keyed(track.name, track.values);
    const shapes = model.meshes.find((mesh) => mesh.node === index)?.blendShapes ?? [];
    const count = Math.round(track.values.length / track.times.length);
    return Array.from({ length: count }, (_, shape) =>
      keyed(`${track.name}[${shapes[shape]?.name ?? shape}]`, track.values.filter((_, i) => i % count === shape)),
    ).flat();
  });
}

/** The track's node and property; null for a name `parseTrackName` can't read (it throws), which keys no node. */
function parsedTrackName(trackName: string): { nodeName: string; propertyName: string; propertyIndex?: string } | null {
  try {
    return PropertyBinding.parseTrackName(trackName);
  } catch {
    return null;
  }
}

function inKeySteps(values: readonly number[]): Int32Array {
  return Int32Array.from(values, (value) => Math.round(value / KEY_STEP));
}
