// One version of a model as three.js objects to draw: its hierarchy with each node's transform, each mesh with one
// material per slot, and a wireframe twin sharing its geometry. Laid out in the viewer's space, which is Unity's
// without its X mirror: Unity draws mirrored coordinates with a left-handed camera, which shows the same picture as
// three's right-handed camera shows the file's own, so the model looks as in Unity's Scene view (`modelSummary`
// keeps Unity's mirrored numbers for what the panel tells).

import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PropertyBinding,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Vector3,
} from 'three';
import type { ModelMesh, ParsedModel } from './parsedModel';
import type { ModelSummary } from './modelSummary';
import { viewerSpaceOf } from './modelSpaces';

export interface ModelScene {
  /** The model in the viewer's space: its units in metres and its axes onto Unity's. */
  root: Group;
  /** Each node's object, by its summary key. */
  objects: Map<string, Object3D>;
  meshes: SceneMesh[];
  /** The skeleton to draw: each bone, and each bone with its parent bone (`boneLinks`). */
  bones: Object3D[];
  links: [Object3D, Object3D][];
  /** Puts every node back where the file has it, after a take moved them. */
  resetPose(): void;
  dispose(): void;
}

export interface SceneMesh {
  /** The node key of the mesh. */
  key: string;
  /** Drawn with `clay` (one material per slot, in the clay or the slot colors), or the Materials look's (`SlotLookMaterials`). */
  solid: Mesh<BufferGeometry, MeshStandardMaterial[]>;
  clay: MeshStandardMaterial[];
  wire: Mesh<BufferGeometry, MeshBasicMaterial>;
  /** The Differences mode's twins, on the same geometry: the version after colored by how far it moved, the version
   *  before as a ghost of what is gone (`heatColors`, set as the geometry's `color`). Hidden in other modes. */
  heat: Mesh<BufferGeometry, MeshStandardMaterial>;
  ghost: Mesh<BufferGeometry, MeshBasicMaterial>;
  /** Each material slot's name, in the order of `solid.material`. */
  slots: string[];
}

export function buildModelScene(model: ParsedModel, summary: ModelSummary): ModelScene {
  const root = new Group();
  root.matrixAutoUpdate = false;
  root.matrix.copy(viewerSpaceOf(model));
  const objects = new Map<string, Object3D>();
  const nodes: Object3D[] = [];
  model.nodes.forEach((node, i) => {
    const object = node.kind === 'bone' ? new Bone() : new Group();
    // As animation tracks address it (FBXLoader and GLTFLoader name their tracks so): `Hand L.001` is `Hand_L001`.
    object.name = PropertyBinding.sanitizeNodeName(node.name);
    object.position.fromArray(node.position);
    object.quaternion.fromArray(node.rotation);
    object.scale.fromArray(node.scale);
    (node.parent < 0 ? root : nodes[node.parent]!).add(object);
    nodes.push(object);
    objects.set(summary.nodes[i]!.key, object);
  });
  const meshes = model.meshes.map((mesh) => {
    const sceneMesh = meshOf(mesh, summary.nodes[mesh.node]!.key);
    nodes[mesh.node]!.add(sceneMesh.solid, sceneMesh.wire, sceneMesh.heat, sceneMesh.ghost);
    return sceneMesh;
  });
  root.updateMatrixWorld(true);
  model.meshes.forEach((mesh, i) => {
    if (mesh.skin) bindSkin(meshes[i]!, mesh.skin, nodes, root.matrix);
  });
  const rest = nodes.map((node) => ({ position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() }));
  return {
    root,
    objects,
    meshes,
    bones: nodes.filter((_, i) => model.nodes[i]!.kind === 'bone'),
    links: boneLinks(model).map(([bone, parent]) => [nodes[bone]!, nodes[parent]!]),
    resetPose() {
      nodes.forEach((node, i) => {
        node.position.copy(rest[i]!.position);
        node.quaternion.copy(rest[i]!.quaternion);
        node.scale.copy(rest[i]!.scale);
      });
    },
    dispose() {
      for (const { solid, clay, wire, heat, ghost } of meshes) {
        solid.geometry.dispose();
        for (const material of clay) material.dispose();
        wire.material.dispose();
        heat.material.dispose();
        ghost.material.dispose();
      }
    },
  };
}

/**
 * The mesh as drawn: in its bind pose (a take poses a skinned one: `ModelAnimationBar`), its slots as groups,
 * its normals computed when the file has none, as Unity's importer does.
 */
function meshOf(mesh: ModelMesh, key: string): SceneMesh {
  const geometry = new BufferGeometry();
  const skinned = mesh.skin !== null && mesh.attributes.skinIndex !== null && mesh.attributes.skinWeight !== null;
  if (skinned) {
    geometry.setAttribute('skinIndex', new BufferAttribute(mesh.attributes.skinIndex!, 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(mesh.attributes.skinWeight!, 4));
  }
  // A skinned mesh and its twins deform alike: each a SkinnedMesh on the one skeleton (`bindSkin`).
  const MeshKind = skinned ? SkinnedMesh : Mesh;
  geometry.setAttribute('position', new BufferAttribute(mesh.attributes.position, 3));
  if (mesh.attributes.normal) geometry.setAttribute('normal', new BufferAttribute(mesh.attributes.normal, 3));
  if (mesh.attributes.uv) geometry.setAttribute('uv', new BufferAttribute(mesh.attributes.uv, 2));
  if (mesh.index) geometry.setIndex(new BufferAttribute(mesh.index, 1));
  if (!mesh.attributes.normal) geometry.computeVertexNormals();
  for (const group of mesh.groups) geometry.addGroup(group.start, group.count, group.slot);
  geometry.computeBoundingSphere();
  const materials = mesh.slots.map((slot) => new MeshStandardMaterial({ name: slot, roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const solid = new MeshKind(geometry, materials);
  const wire = new MeshKind(geometry, new MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false }));
  const heat = new MeshKind(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const ghost = new MeshKind(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  heat.visible = false;
  ghost.visible = false;
  for (const object of [solid, wire, heat, ghost]) object.userData.key = key;
  return { key, solid, clay: materials, wire, heat, ghost, slots: mesh.slots };
}

/** Each bone with its parent, where the parent is a bone too: the skeleton's lines. */
export function boneLinks(model: Pick<ParsedModel, 'nodes'>): [number, number][] {
  return model.nodes.flatMap((node, i) => (node.kind === 'bone' && node.parent >= 0 && model.nodes[node.parent]!.kind === 'bone' ? [[i, node.parent] as [number, number]] : []));
}

/**
 * Binds a skinned mesh and its twins to its bones. The file's inverse bind matrices are in the loader's space; the
 * scene's root puts the model in the viewer's (`viewerSpace`), so each is carried there (`inverse × viewerSpace⁻¹`),
 * or the root's units and axes would skin the mesh twice.
 */
function bindSkin(mesh: SceneMesh, skin: NonNullable<ModelMesh['skin']>, nodes: Object3D[], viewerSpace: Matrix4): void {
  const toViewer = viewerSpace.clone().invert();
  const inverses = skin.bones.map((_, i) => new Matrix4().fromArray(skin.boneInverses, i * 16).multiply(toViewer));
  // A bone the file names is a node of the hierarchy; a joint the loader made an empty still moves the mesh.
  const bones = skin.bones.map((node) => nodes[node] ?? new Bone()) as Bone[];
  const skeleton = new Skeleton(bones, inverses);
  for (const object of [mesh.solid, mesh.wire, mesh.heat, mesh.ghost]) {
    (object as unknown as SkinnedMesh).bind(skeleton, object.matrixWorld);
    // Its bounds are the bind pose's: a take that moves it out of them mustn't cull it.
    object.frustumCulled = false;
  }
}

/** A box in the viewer's space from one in Unity's (`modelSummary`'s bounds): X mirrored back. */
export function viewerBounds(bounds: { min: number[]; max: number[] }): { min: Vector3; max: Vector3 } {
  return { min: new Vector3(-bounds.max[0]!, bounds.min[1]!, bounds.min[2]!), max: new Vector3(-bounds.min[0]!, bounds.max[1]!, bounds.max[2]!) };
}

/** Where a node's origin sits in the viewer's space: its pivot. */
export function pivotOf(scene: ModelScene, key: string): Vector3 | null {
  const object = scene.objects.get(key);
  return object ? new Vector3().setFromMatrixPosition(object.matrixWorld) : null;
}

/**
 * How the model is turned, in the viewer's space: the rotation of the deepest node every mesh hangs under (the mesh
 * itself, when it is the only one), so the pivot's axes turn with what turned, as Unity's pivot gizmo does.
 */
export function modelOrientation(scene: ModelScene): Quaternion {
  const chains = scene.meshes.map(({ solid }) => {
    const chain: Object3D[] = [];
    for (let object: Object3D | null = solid.parent; object; object = object.parent) chain.unshift(object);
    return chain;
  });
  let carrier: Object3D = scene.root;
  for (let depth = 0; chains.length > 0 && chains.every((chain) => chain[depth] !== undefined && chain[depth] === chains[0]![depth]); depth++) carrier = chains[0]![depth]!;
  const rotation = new Quaternion();
  carrier.matrixWorld.decompose(new Vector3(), rotation, new Vector3());
  return rotation;
}
