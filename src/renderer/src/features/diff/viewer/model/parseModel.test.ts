import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelBytes, ModelFormat } from '@shared/domain/content';
import { gltfCompanions } from './gltfJson';
import { parseModel } from './parseModel';
import type { ParsedModel } from './parsedModel';
import { fbxAxisConversion, Y_UP_AXES } from './fbxAxes';
import { asciiFbx, box } from './testing/asciiFbx';

const bytesOf = (text: string, format: ModelFormat): ModelBytes => ({ bytes: new TextEncoder().encode(text), format });

async function parsed(model: ModelBytes, companions?: Record<string, Uint8Array>): Promise<ParsedModel> {
  const result = await parseModel(model, companions);
  if (result.kind !== 'parsed') throw new Error(`Not parsed: ${JSON.stringify(result.failure)}`);
  return result.model;
}

const names = (model: ParsedModel): string[] => model.nodes.map((node) => node.name);

describe('parseModel, FBX', () => {
  const crate = asciiFbx({
    application: { name: 'Blender (stable FBX IO)', version: '4.2.1' },
    nodes: [
      { name: 'Crate', kind: 'group' },
      { name: 'Lid.001', kind: 'mesh', parent: 'Crate', translation: [0, 50, 0], mesh: { ...box([100, 10, 100]), materials: ['Wood', 'Metal'], polygonMaterials: [0, 0, 1, 1, 0, 0], uvs: true } },
      { name: 'Hand L', kind: 'bone', parent: 'Crate' },
    ],
  });

  it('reads the hierarchy with the names Unity gives its GameObjects', async () => {
    const model = await parsed(bytesOf(crate, 'fbx'));
    // A file with one top-level node: that node is the model's root, as in Unity.
    expect(names(model)).toEqual(['Crate', 'Lid.001', 'Hand L']);
    expect(model.nodes.map((node) => node.kind)).toEqual(['group', 'mesh', 'bone']);
    expect(model.nodes.map((node) => node.parent)).toEqual([-1, 0, 0]);
    expect(model.nodes[1]!.position).toEqual([0, 50, 0]);
  });

  it('reads the material slots each polygon uses, and the UVs', async () => {
    const [mesh] = (await parsed(bytesOf(crate, 'fbx'))).meshes;
    expect(mesh!.slots).toEqual(['Wood', 'Metal']);
    expect(new Set(mesh!.groups.map((group) => group.slot))).toEqual(new Set([0, 1]));
    expect(mesh!.groups.reduce((sum, group) => sum + group.count, 0)).toBe(36);
    expect(mesh!.attributes.position.length).toBe(36 * 3);
    expect(mesh!.attributes.uv?.length).toBe(36 * 2);
  });

  it('takes the units and the exporting app from the file', async () => {
    const model = await parsed(bytesOf(crate, 'fbx'));
    expect(model.unitScale).toBe(1);
    expect(model.exportedFrom).toBe('Blender 4.2.1');
    const centimetres = await parsed(bytesOf(asciiFbx({ unitScaleFactor: 1, nodes: [{ name: 'Rock', kind: 'mesh', mesh: { ...box([1, 1, 1]), materials: ['Rock'] } }] }), 'fbx'));
    expect(centimetres.unitScale).toBe(0.01);
    expect(centimetres.exportedFrom).toBeNull();
  });

  it('reads each take as a clip of its name, as long as its last key', async () => {
    const waving = asciiFbx({
      nodes: [
        { name: 'Hips', kind: 'bone' },
        { name: 'UpperArm_L', kind: 'bone', parent: 'Hips', translation: [20, 30, 0] },
      ],
      takes: [{ name: 'Take 001', length: 3.2, curves: [{ node: 'UpperArm_L', property: 'rotation', times: [0, 1.6, 3.2], values: [[0, 0, 0], [0, 0, 80], [0, 0, 0]] }] }],
    });
    const model = await parsed(bytesOf(waving, 'fbx'));
    expect(model.clips.map((clip) => clip.name)).toEqual(['Take 001']);
    expect(model.clips[0]!.duration).toBeCloseTo(3.2);
    expect(model.clips[0]!.tracks.tracks.map((track) => track.name)).toEqual(['UpperArm_L.quaternion']);
  });

  it("reads each slot's material: its color, and the textures it maps by the paths the file stores", async () => {
    const tree = asciiFbx({
      nodes: [{ name: 'Tree', kind: 'mesh', mesh: { ...box([1, 1, 1]), materials: ['Bark', 'Leaves'], polygonMaterials: [0, 0, 0, 1, 1, 1], uvs: true } }],
      materials: {
        Bark: { diffuse: [1, 0.5, 0], diffuseTexture: { fileName: 'C:\\Art\\bark.png', relativeFileName: '..\\Textures\\bark.png' }, normalTexture: { fileName: 'C:\\Art\\bark_n.png' } },
        Leaves: { diffuse: [0.2, 0.6, 0.2], opacity: 0.5 },
      },
    });
    const [bark, leaves] = (await parsed(bytesOf(tree, 'fbx'))).materials;
    expect(bark).toMatchObject({
      name: 'Bark',
      // FBXLoader asks for the relative path's last part; the file stores both paths.
      baseMap: { texture: { kind: 'named', name: 'bark.png', storedPaths: ['..\\Textures\\bark.png', 'C:\\Art\\bark.png', 'bark.png'] }, repeat: [1, 1], offset: [0, 0] },
      normalMap: { texture: { kind: 'named', name: 'bark_n.png' } },
      alpha: 'opaque',
    });
    // The file's sRGB colors, in three's linear working space.
    expect(bark!.color.map((value) => Number(value.toFixed(3)))).toEqual([1, 0.214, 0]);
    expect(leaves).toMatchObject({ name: 'Leaves', baseMap: null, opacity: 0.5, alpha: 'blend' });
  });

  it('converts a Z-up file onto Y by its axes, apart from the root rotation FBXLoader set', async () => {
    const model = await parsed(bytesOf(asciiFbx({ upAxis: 2, nodes: [{ name: 'Rock', kind: 'mesh', mesh: { ...box([1, 1, 1]), materials: ['Rock'] } }] }), 'fbx'));
    expect(model.upAxis).toBe('z');
    // The file names no front or coord axis: they read as Y-up's, so its Z (up) becomes Y and its Y (front, unnamed) Z.
    expect(model.axisConversion).toEqual(fbxAxisConversion({ ...Y_UP_AXES, upAxis: 2 }));
    expect(model.nodes.every((node) => node.rotation.every((value, i) => value === [0, 0, 0, 1][i]))).toBe(true);
  });
});

describe('parseModel, OBJ', () => {
  it('reads groups as nodes and usemtl as material slots', async () => {
    const obj = ['v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'v 1 1 0', 'o Wall', 'usemtl Brick', 'f 1 2 3', 'usemtl Plaster', 'f 2 4 3'].join('\n');
    const model = await parsed(bytesOf(obj, 'obj'));
    expect(model.meshes).toHaveLength(1);
    expect(model.nodes[model.meshes[0]!.node]!.name).toBe('Wall');
    expect(model.meshes[0]!.slots).toEqual(['Brick', 'Plaster']);
    expect(model.unitScale).toBe(1);
  });

  it('keeps the faces of an object that has a line element too, as Unity does', async () => {
    const obj = ['o Barn', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'f 1 2 3', 'l 1 2'].join('\r\n');
    const model = await parsed(bytesOf(obj, 'obj'));
    expect(model.meshes).toHaveLength(1);
    expect(model.meshes[0]!.attributes.position.length).toBe(9);
  });
});

/** A one-triangle glTF, its buffer inline or in a file of its own. */
function triangleGltf(bufferUri: string, extra: Record<string, unknown> = {}): string {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const uri = bufferUri === 'inline' ? `data:application/octet-stream;base64,${Buffer.from(positions.buffer).toString('base64')}` : bufferUri;
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Leaf', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ name: 'Foliage', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ uri: 'textures/leaf.png' }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36, uri }],
    ...extra,
  });
}

describe('parseModel, glTF', () => {
  // GLTFLoader reads `self.URL`, and its FileLoader reports progress with `ProgressEvent`: globals a page and a worker
  // have and Node hasn't.
  beforeEach(() => {
    vi.stubGlobal('self', globalThis);
    vi.stubGlobal('ProgressEvent', class extends Event {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads a glTF whose buffer is inline, naming its textures without reading them', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const model = await parsed(bytesOf(triangleGltf('inline'), 'gltf'));
    // The inline buffer is read through a fetch of its `data:` URI, and nothing else is.
    expect(fetch.mock.calls.map(([request]) => (request instanceof Request ? request.url : String(request)).slice(0, 5))).toEqual(['data:']);
    fetch.mockRestore();
    expect(model.nodes.map((node) => node.name)).toContain('Leaf');
    expect(model.meshes[0]!.slots).toEqual(['Foliage']);
    expect(model.textures).toEqual(['leaf.png']);
  });

  it('reads a glTF whose geometry is in a file beside it, given its bytes', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const model = await parsed(bytesOf(triangleGltf('Leaf%20data.bin'), 'gltf'), { 'Leaf data.bin': new Uint8Array(positions.buffer) });
    expect([...model.meshes[0]!.attributes.position]).toEqual([...positions]);
  });

  it('names the file a glTF keeps its geometry in', async () => {
    expect(await parseModel(bytesOf(triangleGltf('scene%20data.bin'), 'gltf'))).toEqual({ kind: 'failed', failure: { kind: 'externalData', file: 'scene data.bin' } });
  });

  it('lists the files a glTF needs beside it, and none for a self-contained one', () => {
    expect(gltfCompanions(new TextEncoder().encode(triangleGltf('scene.bin')), 'gltf')).toEqual(['scene.bin']);
    expect(gltfCompanions(new TextEncoder().encode(triangleGltf('inline')), 'gltf')).toEqual([]);
    expect(gltfCompanions(new Uint8Array([1, 2]), 'fbx')).toEqual([]);
  });

  it("lists no companion for a glTF whose buffers aren't what glTF writes, rather than failing", () => {
    const json = (buffers: unknown) => new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, buffers }));
    expect(gltfCompanions(json([{ uri: '100%.bin' }]), 'gltf')).toEqual(['100%.bin']);
    expect(gltfCompanions(json([{ uri: 7 }]), 'gltf')).toEqual([]);
    expect(gltfCompanions(json({}), 'gltf')).toEqual([]);
  });

  it("reads each material's base color, maps, alpha and sides, and where each map's image is", async () => {
    const gltf = triangleGltf('inline', {
      extensionsUsed: ['KHR_texture_transform'],
      materials: [
        {
          name: 'Foliage',
          alphaMode: 'MASK',
          alphaCutoff: 0.3,
          doubleSided: true,
          pbrMetallicRoughness: { baseColorFactor: [0.5, 1, 1, 1], baseColorTexture: { index: 0, extensions: { KHR_texture_transform: { scale: [2, 2], offset: [0.5, 0] } } } },
          normalTexture: { index: 1 },
        },
      ],
      textures: [{ source: 0 }, { source: 1 }],
      images: [{ uri: 'textures/leaf%20color.png' }, { bufferView: 0, mimeType: 'image/png' }],
    });
    const [foliage] = (await parsed(bytesOf(gltf, 'gltf'))).materials;
    expect(foliage).toMatchObject({
      name: 'Foliage',
      color: [0.5, 1, 1],
      baseMap: { texture: { kind: 'beside', path: 'textures/leaf color.png' }, repeat: [2, 2], offset: [0.5, 0] },
      normalMap: { texture: { kind: 'gltfImage', image: 1 } },
      alpha: 'clip',
      cutoff: 0.3,
      doubleSided: true,
    });
  });

  it('names the compression a glTF needs a decoder for', async () => {
    const draco = triangleGltf('inline', { extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'] });
    expect(await parseModel(bytesOf(draco, 'gltf'))).toEqual({ kind: 'failed', failure: { kind: 'compressed', compression: 'Draco' } });
  });
});

describe('parseModel, unreadable files', () => {
  it('fails on bytes that are no model of their format', async () => {
    expect(await parseModel(bytesOf('not a model', 'fbx'))).toEqual({ kind: 'failed', failure: { kind: 'unreadable' } });
    expect(await parseModel(bytesOf('{', 'gltf'))).toEqual({ kind: 'failed', failure: { kind: 'unreadable' } });
  });
});
