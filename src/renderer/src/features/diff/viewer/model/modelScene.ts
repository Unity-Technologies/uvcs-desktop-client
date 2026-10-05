// One version of a model as three.js objects to draw: its hierarchy with each node's transform, each mesh with one
// material per slot, and a wireframe twin sharing its geometry. Laid out in the viewer's space, which is Unity's
// without its X mirror: Unity draws mirrored coordinates with a left-handed camera, which shows the same picture as
// three's right-handed camera shows the file's own, so the model looks as in Unity's Scene view (`modelSummary`
// keeps Unity's mirrored numbers for what the panel tells).

import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from 'three';
import type { ModelMesh, ParsedModel } from './parsedModel';
import type { ModelSummary } from './modelSummary';
import { viewerSpaceOf } from './modelSpaces';

export interface ModelScene {
  /** The model in the viewer's space: its units in metres and its axes onto Unity's. */
  root: Group;
  /** Each node's object, by its summary key. */
  objects: Map<string, Object3D>;
  meshes: SceneMesh[];
  dispose(): void;
}

export interface SceneMesh {
  /** The node key of the mesh. */
  key: string;
  solid: Mesh<BufferGeometry, MeshStandardMaterial[]>;
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
    const object = new Group();
    object.name = node.name;
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
  return {
    root,
    objects,
    meshes,
    dispose() {
      for (const { solid, wire, heat, ghost } of meshes) {
        solid.geometry.dispose();
        for (const material of solid.material) material.dispose();
        wire.material.dispose();
        heat.material.dispose();
        ghost.material.dispose();
      }
    },
  };
}

/**
 * The mesh as drawn: in its bind pose (skinned meshes are posed by their animations, Phase 2's), its slots as groups,
 * its normals computed when the file has none, as Unity's importer does.
 */
function meshOf(mesh: ModelMesh, key: string): SceneMesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.attributes.position, 3));
  if (mesh.attributes.normal) geometry.setAttribute('normal', new BufferAttribute(mesh.attributes.normal, 3));
  if (mesh.attributes.uv) geometry.setAttribute('uv', new BufferAttribute(mesh.attributes.uv, 2));
  if (mesh.index) geometry.setIndex(new BufferAttribute(mesh.index, 1));
  if (!mesh.attributes.normal) geometry.computeVertexNormals();
  for (const group of mesh.groups) geometry.addGroup(group.start, group.count, group.slot);
  geometry.computeBoundingSphere();
  const materials = mesh.slots.map((slot) => new MeshStandardMaterial({ name: slot, roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const solid = new Mesh(geometry, materials);
  const wire = new Mesh(geometry, new MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false }));
  const heat = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const ghost = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  heat.visible = false;
  ghost.visible = false;
  for (const object of [solid, wire, heat, ghost]) object.userData.key = key;
  return { key, solid, wire, heat, ghost, slots: mesh.slots };
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
