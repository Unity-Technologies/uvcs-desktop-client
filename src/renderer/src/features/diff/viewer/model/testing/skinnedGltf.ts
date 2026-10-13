// A skinned glTF laid out as Sketchfab exports a character: a `Sketchfab_model` root turning Z up onto Y, a node
// scaling centimetres to metres under it, and beside each other there the skinned mesh and its joint. The mesh's
// vertices are the source file's (centimetres, Z up) and its node holds nothing of where it is: glTF skins a mesh by
// its joints alone (`joint's world × inverse bind`), so the inverse bind matrix carries the vertices into the joint.

/** Where the triangle's top corner, 180 cm up the source file's Z, stands once skinned: 1.8 m up Y. */
export const SKINNED_TOP_CORNER = 2;

/** The triangle's corners in the source file's space: centimetres, Z up. */
const POSITIONS = [0, 0, 0, 10, 0, 0, 0, 0, 180];
/** Every corner wholly on the one joint. */
const JOINTS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const WEIGHTS = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const HIPS_HEIGHT_CM = 100;
/** Column-major: the joint's inverse bind, taking the source file's vertices to the joint (100 cm below it). */
const HIPS_INVERSE_BIND = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -HIPS_HEIGHT_CM, 1];
/** Column-major: -90° on X, Z up onto Y, with the float noise Sketchfab writes where a cosine is 0. */
const Z_UP_TO_Y_UP = [1, 0, 0, 0, 0, 2.220446049250313e-16, -1, 0, 0, 1, 2.220446049250313e-16, 0, 0, 0, 0, 1];

export function skinnedGltf(): string {
  const positions = new Float32Array(POSITIONS);
  const joints = new Uint16Array(JOINTS);
  const weights = new Float32Array(WEIGHTS);
  const inverseBind = new Float32Array(HIPS_INVERSE_BIND);
  const views = [positions, joints, weights, inverseBind];
  const offsets = views.map((_, i) => views.slice(0, i).reduce((total, view) => total + view.byteLength, 0));
  const buffer = new Uint8Array(views.reduce((total, view) => total + view.byteLength, 0));
  views.forEach((view, i) => buffer.set(new Uint8Array(view.buffer), offsets[i]));
  return JSON.stringify({
    asset: { version: '2.0', generator: 'Sketchfab-16.85.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Sketchfab_model', matrix: Z_UP_TO_Y_UP, children: [1] },
      { name: 'RootNode', scale: [0.01, 0.01, 0.01], children: [2, 3] },
      { name: 'Body', mesh: 0, skin: 0 },
      { name: 'Hips', translation: [0, 0, HIPS_HEIGHT_CM] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    skins: [{ joints: [3], skeleton: 3, inverseBindMatrices: 3 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [10, 0, 180] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
      { bufferView: 3, componentType: 5126, count: 1, type: 'MAT4' },
    ],
    bufferViews: views.map((view, i) => ({ buffer: 0, byteOffset: offsets[i], byteLength: view.byteLength })),
    buffers: [{ byteLength: buffer.byteLength, uri: `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}` }],
  });
}
