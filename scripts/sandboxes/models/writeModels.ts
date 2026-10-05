// Writes the models sandbox's Unity project (`scripts/sandboxes/models.sh`) as it stands after one step of its
// history: every model (FBX, OBJ, glTF, GLB; the glTF ones in `gltfModels.ts`), its `.meta` (`unityMeta.ts`) and a
// prefab. Each step changes one thing an artist would, on top
// of the step before it, so each changeset shows one model diff case. Only the files whose bytes change are written,
// and the models a step leaves out are deleted, so `cm ci --all --private` checks in exactly that step.
// Usage (models.sh bundles it with esbuild first): node writeModels.mjs <step> <workspace>

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { asciiFbx, box, sphere, type FbxNodeSpec } from '../../../src/renderer/src/features/diff/viewer/model/testing/asciiFbx';
import { barrelGltf, scoutGlb, type ScoutVersion } from './gltfModels';
import { defaultImporterMeta, gltfastImporterMeta, guidOf, modelImporterMeta } from './unityMeta';

/** What the artists have done so far: each step changes some of it. */
interface Project {
  blenderVersion: string;
  crate: { unitScaleFactor: number; lidPivotAtHinge: boolean; woodSlot: string; labelSlot: boolean };
  rock: { rotationX: number; sculpted: boolean; rings: number; segments: number };
  robot: { leftHand: string; helmetOnHead: boolean; backpack: boolean; antenna: boolean; fingers: boolean };
  barrel: { segments: number; uvAtlas: boolean };
  placeholderCube: boolean;
  lantern: { scale: number } | null;
  scout: ScoutVersion | null;
  /** The barrel exported again as a glTF, its geometry in a `.bin`: its height, in metres. */
  barrelGltf: { height: number } | null;
}

const INITIAL: Project = {
  blenderVersion: '4.2.1',
  crate: { unitScaleFactor: 100, lidPivotAtHinge: false, woodSlot: 'Wood', labelSlot: false },
  rock: { rotationX: 0, sculpted: false, rings: 8, segments: 12 },
  robot: { leftHand: 'Hand_L', helmetOnHead: false, backpack: true, antenna: false, fingers: false },
  barrel: { segments: 12, uvAtlas: false },
  placeholderCube: true,
  lantern: null,
  scout: null,
  barrelGltf: null,
};

interface Step {
  /** The step this one builds on; none for the first. */
  after?: string;
  change: (project: Project) => void;
}

/** The history, in models.sh's order. `art-*` are on the branch /main/art-pass; `pending` is left uncommitted. */
const STEPS: Record<string, Step> = {
  initial: { change: () => {} },
  reexport: { after: 'initial', change: (p) => (p.blenderVersion = '4.2.3') },
  'crate-centimetres': { after: 'reexport', change: (p) => (p.crate.unitScaleFactor = 1) },
  'rock-turned': { after: 'crate-centimetres', change: (p) => (p.rock.rotationX = -90) },
  'crate-pivot': { after: 'rock-turned', change: (p) => (p.crate.lidPivotAtHinge = true) },
  'robot-hierarchy': {
    after: 'crate-pivot',
    change: (p) => Object.assign(p.robot, { leftHand: 'hand.L', helmetOnHead: true, backpack: false, antenna: true }),
  },
  'crate-slots': { after: 'robot-hierarchy', change: (p) => Object.assign(p.crate, { woodSlot: 'Wood_mat', labelSlot: true }) },
  'rock-sculpt': { after: 'crate-slots', change: (p) => (p.rock.sculpted = true) },
  'rock-polycount': { after: 'rock-sculpt', change: (p) => Object.assign(p.rock, { rings: 32, segments: 48 }) },
  'barrel-uvs': { after: 'rock-polycount', change: (p) => (p.barrel.uvAtlas = true) },
  'lantern-replaces-cube': { after: 'barrel-uvs', change: (p) => Object.assign(p, { placeholderCube: false, lantern: { scale: 1 } }) },
  'art-barrel': { after: 'lantern-replaces-cube', change: (p) => (p.barrel.segments = 32) },
  'art-fingers': { after: 'art-barrel', change: (p) => (p.robot.fingers = true) },
  'art-lantern': { after: 'art-fingers', change: (p) => (p.lantern = { scale: 1.5 }) },
  scout: { after: 'lantern-replaces-cube', change: (p) => (p.scout = { wave: 'first', jump: false }) },
  'scout-snappier': { after: 'scout', change: (p) => (p.scout = { wave: 'snappier', jump: true }) },
  'barrel-gltf': { after: 'scout-snappier', change: (p) => (p.barrelGltf = { height: 0.9 }) },
  'barrel-gltf-taller': { after: 'barrel-gltf', change: (p) => (p.barrelGltf = { height: 1.2 }) },
  pending: { after: 'barrel-gltf-taller', change: (p) => (p.crate.unitScaleFactor = 100) },
};

function projectAfter(stepName: string): Project {
  const step = STEPS[stepName];
  if (!step) throw new Error(`No step named ${stepName}. Steps: ${Object.keys(STEPS).join(', ')}`);
  const project = step.after ? projectAfter(step.after) : structuredClone(INITIAL);
  step.change(project);
  return project;
}

const MODELS = 'Assets/Models';

/** A file's text or bytes; null for one the project doesn't hold at this step. */
type FileContent = string | Uint8Array | null;

/** Every file the project can hold, by path. */
async function filesOf(p: Project): Promise<Record<string, FileContent>> {
  const barrelExport = p.barrelGltf ? await barrelGltf(p.barrelGltf.height) : null;
  const models: Record<string, FileContent> = {
    [`${MODELS}/Props/Crate.fbx`]: crate(p),
    [`${MODELS}/Props/Rock.fbx`]: rock(p),
    [`${MODELS}/Props/Barrel.obj`]: barrel(p),
    [`${MODELS}/Props/Barrel.gltf`]: barrelExport?.gltf ?? null,
    [`${MODELS}/Props/Placeholder_Cube.fbx`]: p.placeholderCube ? placeholderCube() : null,
    [`${MODELS}/Props/Lantern.gltf`]: p.lantern ? lantern(p.lantern.scale) : null,
    [`${MODELS}/Characters/Robot.fbx`]: robot(p),
    [`${MODELS}/Characters/Scout.glb`]: p.scout ? await scoutGlb(p.scout) : null,
  };
  const files: Record<string, FileContent> = { ...models };
  for (const [path, content] of Object.entries(models)) files[`${path}.meta`] = content === null ? null : modelMeta(path);
  // Unity imports the glTF, not its buffer: the `.bin` is an asset of no type to it.
  files[`${MODELS}/Props/Barrel.bin`] = barrelExport?.bin ?? null;
  files[`${MODELS}/Props/Barrel.bin.meta`] = barrelExport ? defaultImporterMeta(`${MODELS}/Props/Barrel.bin`) : null;
  files['Assets/Prefabs/Robot.prefab'] = robotPrefab();
  files['ProjectSettings/ProjectVersion.txt'] = 'm_EditorVersion: 6000.3.10f1\n';
  return files;
}

// Blender exports in metres (UnitScaleFactor 100); a re-export in centimetres (1) makes Unity import it 100× smaller.
function blender(p: Project): { name: string; version: string } {
  return { name: 'Blender (stable FBX IO)', version: p.blenderVersion };
}

function crate(p: Project): string {
  const { unitScaleFactor, lidPivotAtHinge, woodSlot, labelSlot } = p.crate;
  // The lid stays where it was when its pivot moves to the hinge at its back edge: the node moves, its geometry back.
  const lidPivot: [number, number, number] = lidPivotAtHinge ? [0, 0.45, -0.5] : [0, 0.45, 0];
  const lidCenter: [number, number, number] = lidPivotAtHinge ? [0, 0, 0.5] : [0, 0, 0];
  return asciiFbx({
    application: blender(p),
    unitScaleFactor,
    nodes: [
      { name: 'Crate', kind: 'group' },
      {
        name: 'Body',
        kind: 'mesh',
        parent: 'Crate',
        mesh: {
          ...box([1, 0.8, 1]),
          // The sides are planks, the top and bottom metal; a label on the front once it has one.
          materials: labelSlot ? [woodSlot, 'Metal', 'Label'] : [woodSlot, 'Metal'],
          polygonMaterials: [0, labelSlot ? 2 : 0, 1, 1, 0, 0],
          uvs: true,
        },
      },
      { name: 'Lid', kind: 'mesh', parent: 'Crate', translation: lidPivot, mesh: { ...box([1, 0.1, 1], lidCenter), materials: [woodSlot], uvs: true } },
    ],
  });
}

function rock(p: Project): string {
  const { rotationX, sculpted, rings, segments } = p.rock;
  // The sculpt pushes out one side of the rock, smoothly, keeping every vertex and face.
  const bulge = (x: number, y: number): number => (sculpted ? 0.18 * Math.max(0, x * 0.8 + y * 0.6 - 0.3) : 0);
  return asciiFbx({
    application: blender(p),
    nodes: [{ name: 'Rock', kind: 'mesh', rotation: [rotationX, 0, 0], mesh: { ...sphere(0.5, rings, segments, bulge), materials: ['Rock'], uvs: true } }],
  });
}

function placeholderCube(): string {
  return asciiFbx({ application: { name: 'Blender (stable FBX IO)', version: INITIAL.blenderVersion }, nodes: [{ name: 'Cube', kind: 'mesh', mesh: { ...box([1, 1, 1]), materials: ['Material'] } }] });
}

// Maya works in centimetres (UnitScaleFactor 1): the robot is 180 units tall.
function robot(p: Project): string {
  const { leftHand, helmetOnHead, backpack, antenna, fingers } = p.robot;
  const bone = (name: string, parent: string, translation: [number, number, number]): FbxNodeSpec => ({ name, kind: 'bone', parent, translation });
  const nodes: FbxNodeSpec[] = [
    { name: 'Robot', kind: 'group' },
    { name: 'Armature', kind: 'group', parent: 'Robot' },
    bone('Hips', 'Armature', [0, 95, 0]),
    bone('Spine', 'Hips', [0, 12, 0]),
    bone('Chest', 'Spine', [0, 20, 0]),
    bone('Head', 'Chest', [0, 30, 0]),
    bone('UpperArm_L', 'Chest', [20, 22, 0]),
    bone('Forearm_L', 'UpperArm_L', [28, 0, 0]),
    bone(leftHand, 'Forearm_L', [25, 0, 0]),
    bone('UpperArm_R', 'Chest', [-20, 22, 0]),
    bone('Forearm_R', 'UpperArm_R', [-28, 0, 0]),
    bone('Hand_R', 'Forearm_R', [-25, 0, 0]),
    bone('UpperLeg_L', 'Hips', [10, -5, 0]),
    bone('LowerLeg_L', 'UpperLeg_L', [0, -45, 0]),
    bone('UpperLeg_R', 'Hips', [-10, -5, 0]),
    bone('LowerLeg_R', 'UpperLeg_R', [0, -45, 0]),
  ];
  if (fingers) {
    for (const [hand, side] of [[leftHand, 'L'], ['Hand_R', 'R']] as const) {
      const x = side === 'L' ? 8 : -8;
      nodes.push(bone(`Thumb_${side}`, hand, [x / 2, 0, 4]), bone(`Index_${side}`, hand, [x, 0, 2]), bone(`Middle_${side}`, hand, [x, 0, -2]));
    }
  }
  const torso = box([40, 60, 25], [0, 125, 0]);
  nodes.push({ name: 'Torso', kind: 'mesh', parent: 'Robot', mesh: { ...torso, materials: ['Body_Paint', 'Metal'], polygonMaterials: [0, 0, 1, 1, 0, 0], uvs: true } });
  // On the head bone, the helmet sits at the bone's origin; under the model's root, at the head's height.
  nodes.push({
    name: 'Helmet',
    kind: 'mesh',
    parent: helmetOnHead ? 'Head' : 'Robot',
    mesh: { ...box([28, 28, 28], helmetOnHead ? [0, 10, 0] : [0, 167, 0]), materials: ['Metal', 'Visor_Glass', 'Lights'], polygonMaterials: [1, 0, 0, 2, 0, 0], uvs: true },
  });
  if (backpack) nodes.push({ name: 'Backpack', kind: 'mesh', parent: 'Robot', mesh: { ...box([30, 40, 15], [0, 130, -20]), materials: ['Metal'], uvs: true } });
  if (antenna) nodes.push({ name: 'Antenna', kind: 'mesh', parent: 'Head', mesh: { ...box([2, 25, 2], [8, 35, 0]), materials: ['Metal', 'Lights'], polygonMaterials: [0, 0, 1, 0, 0, 0], uvs: true } });
  return asciiFbx({ application: { name: 'Autodesk Maya', version: '2025.2' }, unitScaleFactor: 1, nodes });
}

/** A barrel as Blender writes an OBJ: banded iron hoops and wooden staves on its body, and a lid, each an object. */
function barrel(p: Project): string {
  const { segments, uvAtlas } = p.barrel;
  const radius = 0.3;
  const heights = [0, 0.1, 0.8, 0.9];
  const lines = [`# Blender ${INITIAL.blenderVersion}`, '# www.blender.org', 'mtllib Barrel.mtl'];
  // The body's vertices: one ring per height, with a seam column (segments + 1) so its UVs can wrap.
  lines.push('o Barrel_Body');
  for (const y of heights) for (let s = 0; s <= segments; s++) lines.push(`v ${vertexOnRing(radius, s / segments, y)}`);
  for (const y of heights) for (let s = 0; s <= segments; s++) lines.push(`vt ${bodyUv(s / segments, y / 0.9, uvAtlas)}`);
  const at = (row: number, s: number): number => row * (segments + 1) + s + 1;
  // Each material's faces together: OBJLoader starts a slot at every `usemtl`, even one it has seen.
  const bands: [string, number[]][] = [['Iron', [0, 2]], ['Wood', [1]]];
  for (const [material, rows] of bands) {
    lines.push(`usemtl ${material}`);
    for (const row of rows) for (let s = 0; s < segments; s++) lines.push(face([at(row, s), at(row, s + 1), at(row + 1, s + 1), at(row + 1, s)]));
  }
  // The lid: a fan around its center, numbered after the body's vertices.
  const first = heights.length * (segments + 1) + 1;
  lines.push('o Barrel_Lid', `v ${vertexOnRing(0, 0, 0.9)}`, `vt ${lidUv(0, 0, uvAtlas)}`);
  for (let s = 0; s < segments; s++) {
    const turn = s / segments;
    lines.push(`v ${vertexOnRing(radius, turn, 0.9)}`, `vt ${lidUv(Math.cos(turn * Math.PI * 2), Math.sin(turn * Math.PI * 2), uvAtlas)}`);
  }
  lines.push('usemtl Wood');
  for (let s = 0; s < segments; s++) lines.push(face([first, first + 1 + ((s + 1) % segments), first + 1 + s]));
  return lines.join('\n') + '\n';
}

function vertexOnRing(radius: number, turn: number, y: number): string {
  const angle = turn * Math.PI * 2;
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)].map(round).join(' ');
}

// First the staves fill the whole texture and the lid is mapped over them; the atlas gives each a half of it.
function bodyUv(u: number, v: number, atlas: boolean): string {
  return (atlas ? [u * 0.5, v] : [u, v]).map(round).join(' ');
}

function lidUv(x: number, z: number, atlas: boolean): string {
  return (atlas ? [0.75 + x * 0.25, 0.5 + z * 0.25] : [0.5 + x * 0.5, 0.5 + z * 0.5]).map(round).join(' ');
}

function face(indices: number[]): string {
  return `f ${indices.map((index) => `${index}/${index}`).join(' ')}`;
}

const round = (value: number): number => Number(value.toFixed(6));

/** A lantern as Blender's glTF exporter writes it: one box, its buffer inline, scaled on its node. */
function lantern(scale: number): string {
  const { vertices, polygons } = box([0.2, 0.35, 0.2]);
  const indices = polygons.flatMap(([a, b, c, d]) => [a!, b!, c!, a!, c!, d!]);
  const positions = Buffer.from(new Float32Array(vertices).buffer);
  const indexBytes = Buffer.from(new Uint16Array(indices).buffer);
  const buffer = Buffer.concat([positions, indexBytes]);
  const min = [0, 1, 2].map((axis) => Math.min(...vertices.filter((_, i) => i % 3 === axis)));
  const max = [0, 1, 2].map((axis) => Math.max(...vertices.filter((_, i) => i % 3 === axis)));
  const gltf = {
    asset: { version: '2.0', generator: 'Khronos glTF Blender I/O v4.2.70' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: 'Lantern', mesh: 0, ...(scale === 1 ? {} : { scale: [scale, scale, scale] }) }],
    meshes: [{ name: 'Lantern', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: 'Lantern_Metal' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertices.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: indexBytes.length },
    ],
    buffers: [{ byteLength: buffer.length, uri: `data:application/octet-stream;base64,${buffer.toString('base64')}` }],
  };
  return JSON.stringify(gltf, null, 2) + '\n';
}

/** Unity imports FBX and OBJ itself, glTF and GLB with glTFast. */
function modelMeta(path: string): string {
  return /\.(gltf|glb)$/.test(path) ? gltfastImporterMeta(path) : modelImporterMeta(path, { globalScale: 1 });
}

function robotPrefab(): string {
  const robotGuid = guidOf(`${MODELS}/Characters/Robot.fbx`);
  return [
    '%YAML 1.1',
    '%TAG !u! tag:unity3d.com,2011:',
    '--- !u!1001 &4810373920124876301',
    'PrefabInstance:',
    '  m_ObjectHideFlags: 0',
    '  serializedVersion: 2',
    '  m_Modification:',
    '    m_TransformParent: {fileID: 0}',
    '    m_Modifications:',
    `    - target: {fileID: -8679921383154817045, guid: ${robotGuid}, type: 3}`,
    '      propertyPath: m_Name',
    '      value: Robot',
    '      objectReference: {fileID: 0}',
    `  m_SourcePrefab: {fileID: 100100000, guid: ${robotGuid}, type: 3}`,
    '',
  ].join('\n');
}

function write(workspace: string, files: Record<string, FileContent>): void {
  for (const [path, content] of Object.entries(files)) {
    const file = join(workspace, ...path.split('/'));
    if (content === null) {
      rmSync(file, { force: true });
    } else if (!existsSync(file) || !readFileSync(file).equals(Buffer.from(content))) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
}

const [stepName, workspace] = process.argv.slice(2);
if (!stepName || !workspace) throw new Error('Usage: node writeModels.mjs <step> <workspace>');
write(workspace, await filesOf(projectAfter(stepName)));
