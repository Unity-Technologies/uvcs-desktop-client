// The models sandbox's textured props (`writeModels.ts`), one per way Unity finds a model's materials and textures
// (docs/features/model-diff.md, "Materials"), with their textures painted in code (no image from elsewhere):
//   Textured/Tree.fbx            its bark in `Textures/` beside it; its leaves' texture missing from the project
//   Textured/Crates/Supply_Crate.fbx   its wood in the parent folder's `Textures/`
//   Textured/Boulder.fbx         a TGA beside it
//   Textured/Bench.fbx           remapped in its .meta to a URP material: a PSD base map and a PNG normal map
//   Textured/Fern.fbx            remapped to an alpha-clipped, double-sided URP material: a leaf card
//   Textured/Sign.gltf           a texture in images/ beside it, by a relative URI
//   Textured/Tile.glb            its texture inside the GLB

import { deflateSync } from 'node:zlib';
import { asciiFbx, box } from '../../../src/renderer/src/features/diff/viewer/model/testing/asciiFbx';
import { unityMaterialYaml } from '../../../src/renderer/src/features/diff/viewer/model/materials/testing/unityMaterialYaml';
import { writeTga, type Pixel } from '../../../src/renderer/src/features/diff/viewer/model/textures/testing/imageWriters';
import { writePsd } from '../../../src/renderer/src/features/diff/viewer/model/textures/testing/psdWriter';
import { guidOf, materialMeta, textureImporterMeta } from './unityMeta';

/** What the artists changed of the textured props: the tree grows in a later changeset. */
export interface TexturedVersion {
  treeHeight: number;
}

type FileContent = string | Uint8Array;

const TEXTURED = 'Assets/Models/Textured';
const BENCH_MATERIAL = 'Assets/Materials/Bench_Wood.mat';
const FERN_MATERIAL = 'Assets/Materials/Fern.mat';

/** Every file of the textured props, by path; the models' own `.meta` files are `writeModels`'s, with `texturedRemaps`. */
export async function texturedFiles(version: TexturedVersion): Promise<Record<string, FileContent>> {
  const textures: Record<string, FileContent> = {
    [`${TEXTURED}/Textures/bark.png`]: png(64, 128, bark),
    [`${TEXTURED}/Textures/crate_wood.png`]: png(128, 128, planks),
    [`${TEXTURED}/stone.tga`]: writeTga(128, 128, stone),
    'Assets/Textures/bench_wood.psd': writePsd({ width: 256, height: 128, mode: 'rgb', compression: 'rle', layerBytes: 512, sample: (x, y, channel) => planks(x, y)[channel]! }),
    'Assets/Textures/bench_wood_n.png': png(128, 64, grooves),
    'Assets/Textures/fern.png': png(128, 256, frond),
    [`${TEXTURED}/images/sign.png`]: png(256, 128, sign),
  };
  const files: Record<string, FileContent> = {
    [`${TEXTURED}/Tree.fbx`]: tree(version.treeHeight),
    [`${TEXTURED}/Crates/Supply_Crate.fbx`]: texturedBox('Supply_Crate', 'Crate_Wood', { fileName: 'D:\\Art\\Crates\\crate_wood.png', relativeFileName: 'crate_wood.png' }, [1, 1, 1]),
    [`${TEXTURED}/Boulder.fbx`]: texturedBox('Boulder', 'Stone', { fileName: '/Users/ana/Art/stone.tga', relativeFileName: 'stone.tga' }, [1.4, 0.9, 1.2]),
    [`${TEXTURED}/Bench.fbx`]: texturedBox('Bench', 'Wood', { fileName: 'C:\\Art\\Bench\\wood.png' }, [1.6, 0.45, 0.4]),
    [`${TEXTURED}/Fern.fbx`]: fern(),
    [`${TEXTURED}/Sign.gltf`]: signGltf(),
    [`${TEXTURED}/Tile.glb`]: tileGlb(png(64, 64, checker)),
    [BENCH_MATERIAL]: unityMaterialYaml({
      name: 'Bench_Wood',
      pipeline: 'urp',
      baseMap: { guid: guidOf('Assets/Textures/bench_wood.psd'), scale: [2, 1] },
      normalMap: { guid: guidOf('Assets/Textures/bench_wood_n.png') },
      baseColor: [1, 0.92, 0.8, 1],
    }),
    [FERN_MATERIAL]: unityMaterialYaml({ name: 'Fern', pipeline: 'urp', baseMap: { guid: guidOf('Assets/Textures/fern.png') }, alpha: 'clip', cutoff: 0.5, doubleSided: true }),
    ...textures,
  };
  for (const path of Object.keys(textures)) files[`${path}.meta`] = textureImporterMeta(path, { normalMap: path.endsWith('_n.png') });
  for (const path of [BENCH_MATERIAL, FERN_MATERIAL]) files[`${path}.meta`] = materialMeta(path);
  return files;
}

/** The slots the textured props' `.meta` files remap to the project's materials, by model. */
export function texturedRemaps(path: string): { slot: string; materialPath: string }[] {
  if (path === `${TEXTURED}/Bench.fbx`) return [{ slot: 'Wood', materialPath: BENCH_MATERIAL }];
  if (path === `${TEXTURED}/Fern.fbx`) return [{ slot: 'Frond', materialPath: FERN_MATERIAL }];
  return [];
}

function tree(height: number): string {
  return asciiFbx({
    nodes: [
      { name: 'Tree', kind: 'group' },
      { name: 'Trunk', kind: 'mesh', parent: 'Tree', mesh: { ...box([30, height * 100, 30], [0, height * 50, 0]), materials: ['Bark'], uvs: true } },
      { name: 'Canopy', kind: 'mesh', parent: 'Tree', mesh: { ...box([160, 120, 160], [0, height * 100 + 40, 0]), materials: ['Leaves'], uvs: true } },
    ],
    materials: {
      Bark: { diffuse: [0.8, 0.8, 0.8], diffuseTexture: { fileName: 'C:\\Art\\Tree\\bark.png', relativeFileName: 'Textures\\bark.png' } },
      // Its texture was never added to the project: the slot shows its green.
      Leaves: { diffuse: [0.25, 0.55, 0.2], diffuseTexture: { fileName: 'C:\\Art\\Tree\\leaves.png', relativeFileName: 'Textures\\leaves.png' } },
    },
  });
}

function texturedBox(name: string, slot: string, texture: { fileName: string; relativeFileName?: string }, size: [number, number, number]): string {
  const centimetres = size.map((value) => value * 100) as [number, number, number];
  return asciiFbx({
    nodes: [{ name, kind: 'mesh', mesh: { ...box(centimetres, [0, centimetres[1] / 2, 0]), materials: [slot], uvs: true } }],
    materials: { [slot]: { diffuse: [0.6, 0.6, 0.6], diffuseTexture: texture } },
  });
}

/** A leaf card: one quad, its UVs 0-1 (planar from X and Y), the fern's outline cut from its alpha. */
function fern(): string {
  return asciiFbx({
    nodes: [{ name: 'Fern', kind: 'mesh', mesh: { vertices: [0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0], polygons: [[0, 1, 2, 3]], materials: ['Frond'], uvs: true } }],
    materials: { Frond: { diffuse: [0.3, 0.6, 0.25] } },
  });
}

/** A sign on a post: a quad whose texture is in `images/` beside the glTF. */
function signGltf(): string {
  const positions = new Float32Array([-0.6, 1, 0, 0.6, 1, 0, 0.6, 1.6, 0, -0.6, 1.6, 0]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const buffer = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(uvs.buffer), Buffer.from(indices.buffer)]);
  return (
    JSON.stringify(
      {
        asset: { version: '2.0', generator: 'uvcs-desktop sandbox' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'Sign', mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
        materials: [{ name: 'Sign_Board', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 } }],
        textures: [{ source: 0 }],
        images: [{ uri: 'images/sign.png' }],
        accessors: [
          { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-0.6, 1, 0], max: [0.6, 1.6, 0] },
          { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
          { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
        ],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 48 },
          { buffer: 0, byteOffset: 48, byteLength: 32 },
          { buffer: 0, byteOffset: 80, byteLength: 12 },
        ],
        buffers: [{ byteLength: buffer.length, uri: `data:application/octet-stream;base64,${buffer.toString('base64')}` }],
      },
      null,
      2,
    ) + '\n'
  );
}

/** A floor tile as GLB: a quad on the ground, its texture a PNG in the GLB's binary chunk. */
function tileGlb(image: Uint8Array): Uint8Array {
  const positions = new Float32Array([-0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, -0.5]);
  const uvs = new Float32Array([0, 2, 2, 2, 2, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const geometry = pad(Buffer.concat([Buffer.from(positions.buffer), Buffer.from(uvs.buffer), Buffer.from(indices.buffer)]), 0);
  const imageOffset = geometry.length;
  const binary = pad(Buffer.concat([geometry, Buffer.from(image)]), 0);
  const json = pad(
    Buffer.from(
      JSON.stringify({
        asset: { version: '2.0', generator: 'uvcs-desktop sandbox' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'Tile', mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
        materials: [{ name: 'Tile_Checker', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 } }],
        samplers: [{ wrapS: 10497, wrapT: 10497 }],
        textures: [{ source: 0, sampler: 0 }],
        images: [{ bufferView: 3, mimeType: 'image/png' }],
        accessors: [
          { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 0, 0.5] },
          { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
          { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
        ],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 48 },
          { buffer: 0, byteOffset: 48, byteLength: 32 },
          { buffer: 0, byteOffset: 80, byteLength: 12 },
          { buffer: 0, byteOffset: imageOffset, byteLength: image.length },
        ],
        buffers: [{ byteLength: binary.length }],
      }),
    ),
    0x20,
  );
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const chunk = (bytes: Buffer, type: number) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(bytes.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, bytes]);
  };
  return new Uint8Array(Buffer.concat([header, chunk(json, 0x4e4f534a), chunk(binary, 0x004e4942)]));
}

function pad(bytes: Buffer, filler: number): Buffer {
  const extra = (4 - (bytes.length % 4)) % 4;
  return extra === 0 ? bytes : Buffer.concat([bytes, Buffer.alloc(extra, filler)]);
}

// The textures, painted: each pixel's RGBA from its place.
const noise = (x: number, y: number): number => (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const bark: Pixel = (x, y) => {
  const groove = Math.abs(Math.sin(x * 0.45 + Math.sin(y * 0.08) * 2)) > 0.85;
  const shade = 90 + Math.abs(noise(x, y)) * 30 - (groove ? 45 : 0);
  return [shade, shade * 0.62, shade * 0.38, 255];
};
const planks: Pixel = (x, y) => {
  const seam = y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 40) % 80 < 2;
  const grain = 150 + Math.sin(x * 0.15 + Math.sin(y * 0.3) * 3) * 20;
  return seam ? [70, 45, 25, 255] : [grain, grain * 0.7, grain * 0.42, 255];
};
const stone: Pixel = (x, y) => {
  const value = 110 + Math.abs(noise(x * 0.3, y * 0.3)) * 60 + Math.sin(x * 0.2) * Math.cos(y * 0.17) * 25;
  return [value, value, value * 0.95, 255];
};
/** A normal map of horizontal grooves: tangent-space normals as RGB, (128, 128, 255) flat. */
const grooves: Pixel = (_x, y) => {
  const slope = Math.cos((y / 8) * Math.PI) * 0.6;
  return [128, Math.round(128 + slope * 127), Math.round(255 - Math.abs(slope) * 60), 255];
};
const frond: Pixel = (x, y) => {
  const along = 1 - y / 256;
  const half = 60 * Math.sin(along * Math.PI) * (0.6 + 0.4 * Math.abs(Math.sin(y * 0.25)));
  const inside = Math.abs(x - 64) < half || Math.abs(x - 64) < 3;
  return inside ? [60 + along * 40, 140 + along * 50, 50, 255] : [40, 90, 30, 0];
};
const sign: Pixel = (x, y) => {
  const border = x < 8 || y < 8 || x > 247 || y > 119;
  const stripe = y > 40 && y < 88 && Math.floor(x / 24) % 2 === 0 && x > 24 && x < 232;
  return border ? [60, 40, 20, 255] : stripe ? [220, 190, 40, 255] : [235, 230, 210, 255];
};
const checker: Pixel = (x, y) => ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? [200, 70, 60, 255] : [240, 235, 225, 255]);

/** A PNG of RGBA pixels, the top row first: the signature, IHDR, one IDAT of the rows (filter 0) deflated, IEND. */
function png(width: number, height: number, pixel: Pixel): Uint8Array {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set(pixel(x, y).map((value) => Math.max(0, Math.min(255, Math.round(value)))), y * (width * 4 + 1) + 1 + x * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]));
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
