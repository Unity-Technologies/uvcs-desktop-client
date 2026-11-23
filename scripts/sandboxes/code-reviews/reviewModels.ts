// The code-review sandbox's 3D models (`code-reviews.sh`), for comments on models: a car as GLB, its body, four
// wheels that share one name (a spot names its part by its names, and the point tells same-named siblings apart), a
// spoiler, a door a take swings open, and a roof antenna skinned to three bones that a take bends (a comment on its tip
// rides the skin, not the antenna's node, which stays put); and a signpost as OBJ, a model written as text. Version 1 is the first
// check-in; version 2 reshapes the body, moves the front wheels forward, drops the spoiler and lowers the sign.
// Usage: node reviewModels.mjs <1|2> <workspace>   (bundled by code-reviews.sh with esbuild, as models.sh does)

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Scene,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** GLTFExporter reads its buffers with the browser's `FileReader`: a stand-in on `Blob.arrayBuffer()`, as `gltfModels.ts`. */
class BlobReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((bytes) => {
      this.result = bytes;
      this.onloadend?.();
    });
  }
}

const scope = globalThis as { FileReader?: unknown };
scope.FileReader ??= BlobReader;

/** Where each front wheel is, by version: version 2 moves them forward. Rear wheels stay at -1.3. */
const FRONT_AXLE = { 1: 1.3, 2: 1.5 } as const;
const WHEEL_RADIUS = 0.36;
const TRACK = 0.82;

type Version = 1 | 2;

/** A car in metres, Y up, its front towards +X: a body and a cabin, four wheels, a spoiler (version 1) and a door. */
async function carGlb(version: Version): Promise<Uint8Array> {
  const paint = new MeshStandardMaterial({ name: 'Car_Paint', color: 0xd94b3d, roughness: 0.35, metalness: 0.2 });
  const glass = new MeshStandardMaterial({ name: 'Car_Glass', color: 0x2c3e50, roughness: 0.1 });
  const rubber = new MeshStandardMaterial({ name: 'Car_Rubber', color: 0x222222, roughness: 0.9 });
  const trim = new MeshStandardMaterial({ name: 'Car_Trim', color: 0x111111, roughness: 0.6 });
  const car = new Group();
  car.name = 'Car';

  const cabinHeight = version === 1 ? 0.45 : 0.55;
  const body = mesh('Body', mergeGeometries([new BoxGeometry(3.9, 0.5, 1.7), new BoxGeometry(2.0, cabinHeight, 1.5).translate(-0.25, 0.25 + cabinHeight / 2, 0)])!, paint);
  body.position.set(0, 0.62, 0);
  body.add(mesh('Windows', new BoxGeometry(2.02, cabinHeight * 0.7, 1.52).translate(-0.25, 0.25 + cabinHeight * 0.5, 0), glass));
  car.add(body);

  for (const [x, z] of [
    [FRONT_AXLE[version], TRACK],
    [FRONT_AXLE[version], -TRACK],
    [-1.3, TRACK],
    [-1.3, -TRACK],
  ] as const) {
    const wheel = mesh('Wheel', new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 28).rotateX(Math.PI / 2), rubber);
    wheel.position.set(x, WHEEL_RADIUS, z);
    car.add(wheel);
  }

  if (version === 1) {
    const spoiler = mesh('Spoiler', mergeGeometries([new BoxGeometry(0.3, 0.05, 1.6).translate(0, 0.22, 0), new BoxGeometry(0.06, 0.2, 0.06).translate(0, 0.1, 0.6), new BoxGeometry(0.06, 0.2, 0.06).translate(0, 0.1, -0.6)])!, trim);
    spoiler.position.set(-1.8, 0.87, 0);
    car.add(spoiler);
  }

  // The driver's door, hinged at its front edge: the take swings it open.
  const door = new Group();
  door.name = 'Door_L';
  door.position.set(0.45, 0.62, 0.86);
  door.add(mesh('Door_Panel', new BoxGeometry(1.1, 0.45, 0.04).translate(-0.55, 0, 0.02), paint));
  car.add(door);

  const open = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -1.1);
  const closed = new Quaternion();
  const doorOpen = new AnimationClip('DoorOpen', 2, [
    new QuaternionKeyframeTrack('Door_L.quaternion', [0, 0.8, 1.2, 2], [...closed.toArray(), ...open.toArray(), ...open.toArray(), ...closed.toArray()]),
  ]);
  const antenna = antennaOf(0.87 + cabinHeight, trim);
  car.add(antenna.mesh, antenna.bones);
  return glb(car, [doorOpen, antenna.sway]);
}

const ANTENNA_HEIGHT = 0.6;
/** Where the antenna stands on the cabin's roof, towards its back and the driver's side. */
const ANTENNA_BASE = { x: -1.0, z: 0.45 } as const;

/**
 * A whip antenna on the roof, `roof` metres up: one mesh skinned to three bones up its length (`Antenna_Base`,
 * `Antenna_Mid`, `Antenna_Tip`), each vertex shared between the two bones it lies between, so a turn of the upper
 * bones bends it. Its take, AntennaSway, swings it back and forth and home again.
 */
function antennaOf(roof: number, material: MeshStandardMaterial): { mesh: SkinnedMesh; bones: Bone; sway: AnimationClip } {
  const segment = ANTENNA_HEIGHT / 2;
  const geometry = new CylinderGeometry(0.008, 0.016, ANTENNA_HEIGHT, 8, 12).translate(0, ANTENNA_HEIGHT / 2, 0);
  const heights = geometry.getAttribute('position');
  const joints: number[] = [];
  const weights: number[] = [];
  for (let vertex = 0; vertex < heights.count; vertex++) {
    const along = Math.min(heights.getY(vertex) / segment, 1.999);
    const lower = Math.floor(along);
    joints.push(lower, lower + 1, 0, 0);
    weights.push(1 - (along - lower), along - lower, 0, 0);
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));

  const base = bone('Antenna_Base', [ANTENNA_BASE.x, roof, ANTENNA_BASE.z]);
  const middle = bone('Antenna_Mid', [0, segment, 0]);
  const tip = bone('Antenna_Tip', [0, segment, 0]);
  base.add(middle);
  middle.add(tip);
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = 'Antenna';
  mesh.position.set(ANTENNA_BASE.x, roof, ANTENNA_BASE.z);
  // Bound where both stand: the skeleton's bones and the mesh at their places, so at rest the antenna is upright.
  const rig = new Group().add(mesh, base);
  rig.updateMatrixWorld(true);
  mesh.bind(new Skeleton([base, middle, tip]));
  rig.remove(mesh, base);

  const lean = (angle: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle).toArray();
  const rest = lean(0);
  const times = [0, 0.6, 1.4, 2];
  const sway = new AnimationClip('AntennaSway', 2, [
    new QuaternionKeyframeTrack('Antenna_Mid.quaternion', times, [...rest, ...lean(0.35), ...lean(-0.3), ...rest]),
    new QuaternionKeyframeTrack('Antenna_Tip.quaternion', times, [...rest, ...lean(0.5), ...lean(-0.45), ...rest]),
  ]);
  return { mesh, bones: base, sway };
}

function bone(name: string, [x, y, z]: [number, number, number]): Bone {
  const made = new Bone();
  made.name = name;
  made.position.set(x, y, z);
  return made;
}

/** A signpost as OBJ: a post and a board, one object each, as Blender writes them. */
function signObj(version: Version): string {
  const boardY = version === 1 ? 1.6 : 1.4;
  const lines = ['# Blender 4.2.3'];
  let base = 1;
  const box = (name: string, [cx, cy, cz]: [number, number, number], [sx, sy, sz]: [number, number, number]): void => {
    lines.push(`o ${name}`);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) lines.push(`v ${(cx + (x * sx) / 2).toFixed(4)} ${(cy + (y * sy) / 2).toFixed(4)} ${(cz + (z * sz) / 2).toFixed(4)}`);
    lines.push('s off');
    for (const face of [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]) lines.push(`f ${face.map((i) => i + base).join(' ')}`);
    base += 8;
  };
  box('Post', [0, 0.9, 0], [0.12, 1.8, 0.12]);
  box('Board', [0, boardY, 0.08], [1.2, 0.5, 0.05]);
  return lines.join('\n') + '\n';
}

function mesh(name: string, geometry: BufferGeometry, material: MeshStandardMaterial): Mesh {
  const made = new Mesh(geometry, material);
  made.name = name;
  return made;
}

async function glb(root: Object3D, animations: AnimationClip[]): Promise<Uint8Array> {
  const scene = new Scene();
  scene.name = 'Scene';
  scene.add(root);
  return new Uint8Array((await new GLTFExporter().parseAsync(scene, { binary: true, animations })) as ArrayBuffer);
}

function write(workspace: string, path: string, content: Uint8Array | string): void {
  const file = join(workspace, ...path.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

const [versionArgument, workspace] = process.argv.slice(2);
const version = Number(versionArgument) as Version;
if ((version !== 1 && version !== 2) || !workspace) throw new Error('Usage: node reviewModels.mjs <1|2> <workspace>');
write(workspace, 'Assets/Models/Car.glb', await carGlb(version));
write(workspace, 'Assets/Models/Sign.obj', signObj(version));
