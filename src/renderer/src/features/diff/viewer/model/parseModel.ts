// A model file's bytes as a `ParsedModel`, through three's loaders for its format. Nothing but the bytes is read
// (`noTextureLoading`), and nothing needs a DOM, so it runs in the parsing worker (`modelParse.worker`) and in tests.

import { Matrix4, Quaternion, type AnimationClip, type Object3D } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { ModelBytes } from '@shared/domain/content';
import { fbxAxisConversion, Y_UP_AXES, type FbxAxisSystem } from './fbxAxes';
import { readFbxProperty, type FbxPropertyName } from './fbxProperties';
import { fromThreeObject, type ModelFileFacts } from './fromThreeObject';
import { gltfNeed, type GltfNeed } from './gltfJson';
import { noTextureLoading } from './noTextureLoading';
import type { ParsedModel } from './parsedModel';

/** Why a model can't be shown: what its bytes don't hold (a glTF's other file, a decoder), or bytes that don't read. */
export type ModelReadFailure = GltfNeed | { kind: 'unreadable' };

export type ModelReadResult = { kind: 'parsed'; model: ParsedModel } | { kind: 'failed'; failure: ModelReadFailure };

/** FBX keeps lengths in centimetres: Unity's "Convert Units" turns them into metres. */
const FBX_UNITS_PER_METRE = 100;
const AXES = ['x', 'y', 'z'] as const;

export async function parseModel({ bytes, format }: ModelBytes): Promise<ModelReadResult> {
  if (format === 'gltf' || format === 'glb') {
    const need = gltfNeed(bytes, format);
    if (need) return { kind: 'failed', failure: need };
  }
  const textures = new Set<string>();
  const manager = noTextureLoading((name) => textures.add(name));
  try {
    const loaded = await load(bytes, format, manager);
    const facts: ModelFileFacts = { format, textures: [...textures].sort(), unitScale: 1, upAxis: 'y', axisConversion: new Matrix4().elements, exportedFrom: null };
    if (format === 'fbx') Object.assign(facts, fbxFacts(bytes, loaded.root));
    return { kind: 'parsed', model: fromThreeObject(loaded.root, loaded.animations, facts) };
  } catch {
    return { kind: 'failed', failure: { kind: 'unreadable' } };
  }
}

interface Loaded {
  root: Object3D;
  animations: AnimationClip[];
}

async function load(bytes: Uint8Array, format: ModelBytes['format'], manager: ReturnType<typeof noTextureLoading>): Promise<Loaded> {
  switch (format) {
    case 'fbx': {
      const root = withCameraWindow(() => new FBXLoader(manager).parse(arrayBufferOf(bytes), ''));
      return { root, animations: root.animations };
    }
    case 'obj':
      return { root: new OBJLoader(manager).parse(withoutLineElements(new TextDecoder().decode(bytes))), animations: [] };
    case 'gltf':
    case 'glb': {
      const gltf = await new GLTFLoader(manager).parseAsync(format === 'gltf' ? new TextDecoder().decode(bytes) : arrayBufferOf(bytes), '');
      return { root: gltf.scene, animations: gltf.animations };
    }
  }
}

/**
 * The FBX's units and axes, which FBXLoader applies only in part: it leaves the units alone, and turns a Z-up file by
 * -90° on X whatever its front axis, setting the root's rotation over the root's own (lost). That turn is taken back
 * and the file's whole axis system converted instead (`fbxAxisConversion`), as Unity converts it.
 */
function fbxFacts(bytes: Uint8Array, root: Object3D): Partial<ModelFileFacts> {
  const axes = fbxAxes(bytes);
  if (axes.upAxis === 2) root.quaternion.copy(new Quaternion());
  const unitScaleFactor = readFbxProperty(bytes, 'UnitScaleFactor');
  return {
    upAxis: AXES[axes.upAxis] ?? 'y',
    axisConversion: fbxAxisConversion(axes),
    unitScale: (typeof unitScaleFactor === 'number' && unitScaleFactor > 0 ? unitScaleFactor : 1) / FBX_UNITS_PER_METRE,
    exportedFrom: exporterOf(bytes),
  };
}

function fbxAxes(bytes: Uint8Array): FbxAxisSystem {
  const read = (name: FbxPropertyName, fallback: number): number => {
    const value = readFbxProperty(bytes, name);
    return typeof value === 'number' ? value : fallback;
  };
  return {
    upAxis: read('UpAxis', Y_UP_AXES.upAxis),
    upAxisSign: read('UpAxisSign', Y_UP_AXES.upAxisSign),
    frontAxis: read('FrontAxis', Y_UP_AXES.frontAxis),
    frontAxisSign: read('FrontAxisSign', Y_UP_AXES.frontAxisSign),
    coordAxis: read('CoordAxis', Y_UP_AXES.coordAxis),
    coordAxisSign: read('CoordAxisSign', Y_UP_AXES.coordAxisSign),
  };
}

/** "Blender 4.2.1" from the scene info's `Original|ApplicationName` ("Blender (stable FBX IO)") and version. */
function exporterOf(bytes: Uint8Array): string | null {
  const name = readFbxProperty(bytes, 'Original|ApplicationName');
  if (typeof name !== 'string' || name === '') return null;
  const version = readFbxProperty(bytes, 'Original|ApplicationVersion');
  const shortName = name.replace(/\s*\(.*\)\s*$/, '');
  return typeof version === 'string' && version !== '' ? `${shortName} ${version}` : shortName;
}

/**
 * FBXLoader (three 0.186) sizes a camera the file holds without an aspect from `window.innerWidth`/`innerHeight`,
 * which a worker hasn't: the parse gets a window of just those two, taken away after it.
 */
function withCameraWindow<T>(parse: () => T): T {
  const scope = globalThis as { window?: unknown };
  if (scope.window !== undefined) return parse();
  scope.window = { innerWidth: 1, innerHeight: 1 };
  try {
    return parse();
  } finally {
    delete scope.window;
  }
}

/**
 * The OBJ without its line elements (`l 1 2`): Unity imports an object's faces and leaves its lines out, while
 * OBJLoader (three 0.186) turns an object with any line into lines only, its faces lost.
 */
function withoutLineElements(text: string): string {
  return text.replace(/^l\s[^\n]*$/gm, '');
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : (bytes.slice().buffer as ArrayBuffer);
}
