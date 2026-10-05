// The models sandbox's glTF models (`writeModels.ts`), built as three.js scenes and written by three's GLTFExporter,
// as Unity users get them from Blender or a web tool: the scout, a skinned character with takes, as GLB; the lamp, a
// prop, as GLB; and a barrel as a `.gltf` with its geometry in a `.bin` beside it.

import {
  AnimationClip,
  Bone,
  BoxGeometry,
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Scene,
  Skeleton,
  SkinnedMesh,
  VectorKeyframeTrack,
  type BufferGeometry,
  type KeyframeTrack,
  type Object3D,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * GLTFExporter reads its buffers out of a `Blob` with the browser's `FileReader`, which Node hasn't: this stand-in
 * reads them with `Blob.arrayBuffer()`, for the two reads the exporter makes (a GLB's bytes, a `.gltf`'s data URI).
 */
class BlobReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((bytes) => this.done(bytes));
  }

  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then((bytes) => this.done(`data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(bytes).toString('base64')}`));
  }

  private done(result: ArrayBuffer | string): void {
    this.result = result;
    this.onloadend?.();
  }
}

const scope = globalThis as { FileReader?: unknown };
scope.FileReader ??= BlobReader;

export interface ScoutVersion {
  /** The first wave (1.2 s, waving from the elbow) or the snappier one (0.8 s, a flick of the wrist, the arm higher). */
  wave: 'first' | 'snappier';
  jump: boolean;
}

/** The scout: a skinned character on a few bones, with an idle, a wave and, later, a jump. */
export async function scoutGlb(version: ScoutVersion): Promise<Uint8Array> {
  const root = new Group();
  root.name = 'Scout';
  const armature = new Group();
  armature.name = 'Armature';
  const bones = scoutSkeleton();
  armature.add(bones.Hips);
  const body = new SkinnedMesh(scoutBody(), new MeshStandardMaterial({ name: 'Scout_Body', color: 0x4a7fbf }));
  body.name = 'Scout_Body';
  root.add(armature, body);
  root.updateMatrixWorld(true);
  body.bind(new Skeleton(SCOUT_BONES.map((name) => bones[name])));
  const takes = [scoutIdle(), version.wave === 'first' ? scoutWave() : scoutSnappierWave(), ...(version.jump ? [scoutJump()] : [])];
  return glb(root, takes);
}

type ScoutBone = 'Hips' | 'Spine' | 'Head' | 'UpperArm_L' | 'Forearm_L' | 'Hand_L';
const SCOUT_BONES: ScoutBone[] = ['Hips', 'Spine', 'Head', 'UpperArm_L', 'Forearm_L', 'Hand_L'];

/** Hips > Spine > Head, and the left arm off the spine; in metres, the hips at 0.9 m. */
function scoutSkeleton(): Record<ScoutBone, Bone> {
  const bone = (name: ScoutBone, position: [number, number, number], parent?: Bone): Bone => {
    const made = new Bone();
    made.name = name;
    made.position.set(...position);
    parent?.add(made);
    return made;
  };
  const Hips = bone('Hips', [0, 0.9, 0]);
  const Spine = bone('Spine', [0, 0.15, 0], Hips);
  const Head = bone('Head', [0, 0.45, 0], Spine);
  const UpperArm_L = bone('UpperArm_L', [0.2, 0.35, 0], Spine);
  const Forearm_L = bone('Forearm_L', [0.25, 0, 0], UpperArm_L);
  const Hand_L = bone('Hand_L', [0.22, 0, 0], Forearm_L);
  return { Hips, Spine, Head, UpperArm_L, Forearm_L, Hand_L };
}

/** The body as boxes, each bound wholly to the bone it moves with; the right arm, never animated, to the spine. */
function scoutBody(): BufferGeometry {
  const part = (size: [number, number, number], center: [number, number, number], bone: ScoutBone): BufferGeometry => {
    const geometry = new BoxGeometry(...size).translate(...center);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(count * 4).map((_, i) => (i % 4 === 0 ? SCOUT_BONES.indexOf(bone) : 0)), 4));
    geometry.setAttribute('skinWeight', new BufferAttribute(new Float32Array(count * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    return geometry;
  };
  return mergeGeometries([
    part([0.3, 0.2, 0.18], [0, 0.9, 0], 'Hips'),
    part([0.12, 0.85, 0.12], [0.09, 0.43, 0], 'Hips'),
    part([0.12, 0.85, 0.12], [-0.09, 0.43, 0], 'Hips'),
    part([0.36, 0.45, 0.2], [0, 1.2, 0], 'Spine'),
    part([0.47, 0.08, 0.08], [-0.43, 1.4, 0], 'Spine'),
    part([0.22, 0.22, 0.22], [0, 1.62, 0], 'Head'),
    part([0.25, 0.08, 0.08], [0.325, 1.4, 0], 'UpperArm_L'),
    part([0.22, 0.07, 0.07], [0.56, 1.4, 0], 'Forearm_L'),
    part([0.1, 0.1, 0.06], [0.72, 1.4, 0], 'Hand_L'),
  ]);
}

/** Breathing: the spine leans a little and the head looks around, over 2 s. */
function scoutIdle(): AnimationClip {
  return new AnimationClip('Idle', 2, [turns('Spine', [0, 1, 2], [[0, 0, 0], [3, 0, 0], [0, 0, 0]]), turns('Head', [0, 1, 2], [[0, 8, 0], [0, -8, 0], [0, 8, 0]])]);
}

/** The arm up at the shoulder, the forearm waving from the elbow, over 1.2 s. */
function scoutWave(): AnimationClip {
  return new AnimationClip('Wave', 1.2, [
    turns('UpperArm_L', [0, 0.3, 0.9, 1.2], [[0, 0, 0], [0, 0, 70], [0, 0, 70], [0, 0, 0]]),
    turns('Forearm_L', [0, 0.3, 0.6, 0.9, 1.2], [[0, 0, 0], [0, 0, 30], [0, 0, -10], [0, 0, 30], [0, 0, 0]]),
  ]);
}

/** The arm higher and straight, the hand flicking from the wrist, over 0.8 s. */
function scoutSnappierWave(): AnimationClip {
  return new AnimationClip('Wave', 0.8, [
    turns('UpperArm_L', [0, 0.2, 0.6, 0.8], [[0, 0, 0], [0, 0, 110], [0, 0, 110], [0, 0, 0]]),
    turns('Hand_L', [0, 0.2, 0.4, 0.6, 0.8], [[0, 0, 0], [0, 0, 40], [0, 0, -40], [0, 0, 40], [0, 0, 0]]),
  ]);
}

/** A crouch, a jump half a metre up with the arm thrown up, and the landing, over 1 s. */
function scoutJump(): AnimationClip {
  return new AnimationClip('Jump', 1, [
    new VectorKeyframeTrack('Hips.position', [0, 0.25, 0.55, 0.85, 1], [0, 0.9, 0, 0, 0.75, 0, 0, 1.4, 0, 0, 0.8, 0, 0, 0.9, 0]),
    turns('UpperArm_L', [0, 0.25, 0.55, 1], [[0, 0, 0], [0, 0, -20], [0, 0, 120], [0, 0, 0]]),
  ]);
}

/** A bone's rotation keyed at `times`, from Euler XYZ angles in degrees. */
function turns(bone: ScoutBone, times: number[], degrees: [number, number, number][]): KeyframeTrack {
  const values = degrees.flatMap(([x, y, z]) => new Quaternion().setFromEuler(new Euler(...([x, y, z].map((angle) => (angle * Math.PI) / 180) as [number, number, number]))).toArray());
  return new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

export interface LampVersion {
  poleHeight: number;
  shadeRadius: number;
}

/** A standing lamp: a base, a pole and a shade, one mesh each. */
export async function lampGlb({ poleHeight, shadeRadius }: LampVersion): Promise<Uint8Array> {
  const root = new Group();
  root.name = 'Lamp';
  const metal = new MeshStandardMaterial({ name: 'Lamp_Metal', color: 0x777777, metalness: 1 });
  const base = mesh('Lamp_Base', new CylinderGeometry(0.18, 0.2, 0.04, 24).translate(0, 0.02, 0), metal);
  const pole = mesh('Lamp_Pole', new CylinderGeometry(0.02, 0.02, poleHeight, 12).translate(0, 0.04 + poleHeight / 2, 0), metal);
  const shade = mesh('Lamp_Shade', new ConeGeometry(shadeRadius, 0.3, 24, 1, true).translate(0, 0.04 + poleHeight, 0), new MeshStandardMaterial({ name: 'Lamp_Fabric', color: 0xe8d9b0 }));
  root.add(base, pole, shade);
  return glb(root, []);
}

/** A barrel as a `.gltf` and the `.bin` its JSON names, as Blender's "glTF Separate" writes them. */
export async function barrelGltf(height: number): Promise<{ gltf: string; bin: Uint8Array }> {
  const barrel = mesh('Barrel', new CylinderGeometry(0.3, 0.3, height, 24).translate(0, height / 2, 0), new MeshStandardMaterial({ name: 'Barrel_Wood', color: 0x8a5a2b }));
  const json = (await new GLTFExporter().parseAsync(inScene(barrel), { binary: false })) as { buffers: { uri: string }[] };
  const [buffer] = json.buffers;
  if (!buffer) throw new Error('The barrel exported no buffer');
  const bin = Buffer.from(buffer.uri.slice(buffer.uri.indexOf(',') + 1), 'base64');
  buffer.uri = 'Barrel.bin';
  return { gltf: JSON.stringify(json, null, 2) + '\n', bin: new Uint8Array(bin) };
}

function mesh(name: string, geometry: BufferGeometry, material: MeshStandardMaterial): Mesh {
  const made = new Mesh(geometry, material);
  made.name = name;
  return made;
}

async function glb(root: Object3D, animations: AnimationClip[]): Promise<Uint8Array> {
  const bytes = await new GLTFExporter().parseAsync(inScene(root), { binary: true, animations });
  return new Uint8Array(bytes as ArrayBuffer);
}

/** The model in a scene named as Blender names its own: exported alone, GLTFExporter would wrap it in an "AuxScene". */
function inScene(root: Object3D): Scene {
  const scene = new Scene();
  scene.name = 'Scene';
  scene.add(root);
  return scene;
}
