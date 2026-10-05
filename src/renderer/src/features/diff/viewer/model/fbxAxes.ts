// How an FBX's axes turn into Unity's. An FBX names its axis system in its global settings: which file axis is up,
// which is front, which is the third ("coord"), each with a sign. Unity's importer maps them onto its own (up Y,
// front Z, coord X; then X mirrored, as for every right-handed file: `unitySpaceOf`). three's FBXLoader only turns a
// Z-up file by -90° on X, which is right for 3ds Max's axes and wrong for others: a file with Z up and X front came
// out with X and Z swapped against Unity.

/** The global settings' axis properties: 0, 1, 2 for X, Y, Z; signs 1 or -1. */
export interface FbxAxisSystem {
  upAxis: number;
  upAxisSign: number;
  frontAxis: number;
  frontAxisSign: number;
  coordAxis: number;
  coordAxisSign: number;
}

/** Y up, Z front, X coord: Maya's and Blender's export default, which needs no turning. */
export const Y_UP_AXES: FbxAxisSystem = { upAxis: 1, upAxisSign: 1, frontAxis: 2, frontAxisSign: 1, coordAxis: 0, coordAxisSign: 1 };

/**
 * The matrix (column-major, as three's `Matrix4.elements`) taking a file position onto Unity's axes before the X
 * mirror: its rows are the file's coord, up and front axes, so a point's X is its coord, its Y its up, its Z its
 * front. Axes that aren't three different ones read as Y up.
 */
export function fbxAxisConversion(axes: FbxAxisSystem): number[] {
  const { upAxis, frontAxis, coordAxis } = axes;
  const valid = [upAxis, frontAxis, coordAxis].every((axis) => axis === 0 || axis === 1 || axis === 2) && new Set([upAxis, frontAxis, coordAxis]).size === 3;
  const { coordAxis: c, coordAxisSign: cs, upAxis: u, upAxisSign: us, frontAxis: f, frontAxisSign: fs } = valid ? axes : Y_UP_AXES;
  const rows = [
    { axis: c, sign: Math.sign(cs) || 1 },
    { axis: u, sign: Math.sign(us) || 1 },
    { axis: f, sign: Math.sign(fs) || 1 },
  ];
  const elements = new Array<number>(16).fill(0);
  rows.forEach(({ axis, sign }, row) => {
    elements[axis * 4 + row] = sign;
  });
  elements[15] = 1;
  return elements;
}
