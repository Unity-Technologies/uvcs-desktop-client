// The spaces a model is placed in: Unity's, where the panel's numbers are told (metres, its axes, X mirrored as
// Unity's importer turns right-handed files left-handed), and the viewer's, where it is drawn (Unity's without the
// mirror: Unity's left-handed camera over mirrored coordinates shows what three's right-handed one shows of the
// file's own).

import { Matrix4, Quaternion, Vector3 } from 'three';
import type { ParsedModel } from './parsedModel';

/** From the file's space to Unity's: its units in metres, its axes onto Unity's, X mirrored. */
export function unitySpaceOf(model: Pick<ParsedModel, 'unitScale' | 'axisConversion'>): Matrix4 {
  const mirror = new Matrix4().makeScale(-1, 1, 1);
  const correction = new Matrix4().fromArray(model.axisConversion);
  const units = new Matrix4().makeScale(model.unitScale, model.unitScale, model.unitScale);
  return mirror.multiply(correction).multiply(units);
}

/** Each node's matrix from its own space to `space` (Unity's by default), in node order. */
export function worldMatricesOf(model: ParsedModel, space: Matrix4 = unitySpaceOf(model)): Matrix4[] {
  const matrices: Matrix4[] = [];
  for (const node of model.nodes) {
    const local = new Matrix4().compose(new Vector3(...node.position), new Quaternion(...node.rotation), new Vector3(...node.scale));
    matrices.push((node.parent < 0 ? space : matrices[node.parent]!).clone().multiply(local));
  }
  return matrices;
}

/** From the file's space to the viewer's: its units in metres and its axes onto Unity's, unmirrored. */
export function viewerSpaceOf(model: Pick<ParsedModel, 'unitScale' | 'axisConversion'>): Matrix4 {
  const units = new Matrix4().makeScale(model.unitScale, model.unitScale, model.unitScale);
  return new Matrix4().fromArray(model.axisConversion).multiply(units);
}
