// What a glTF needs besides its own bytes, read from its JSON before three parses it: a `.gltf` keeps its geometry in
// a `.bin` file next to it more often than inline, and a compressed one needs a decoder the viewer doesn't ship.

import type { ModelFormat } from '@shared/domain/content';

/** Why a glTF can't be shown from its bytes alone. */
export type GltfNeed = { kind: 'externalData'; file: string } | { kind: 'compressed'; compression: 'Draco' | 'meshopt' };

interface GltfJson {
  buffers?: unknown;
  extensionsRequired?: string[];
  textures?: unknown;
  images?: unknown;
  bufferViews?: unknown;
}

/** Extensions that give a texture its image in another format than PNG or JPEG, in its `extensions`. */
const IMAGE_EXTENSIONS = ['EXT_texture_webp', 'EXT_texture_avif', 'KHR_texture_basisu'];

const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;
const GLB_JSON_CHUNK = 0x4e4f534a;

const COMPRESSIONS: Record<string, 'Draco' | 'meshopt'> = {
  KHR_draco_mesh_compression: 'Draco',
  EXT_meshopt_compression: 'meshopt',
  KHR_meshopt_compression: 'meshopt',
};

/**
 * What the glTF needs that its bytes and the `companions` given (its other files, by the name it uses) don't hold, or
 * null when they're enough. A JSON that doesn't read is the loader's to report.
 */
export function gltfNeed(bytes: Uint8Array, format: Extract<ModelFormat, 'gltf' | 'glb'>, companions: ReadonlySet<string> = new Set()): GltfNeed | null {
  const json = readJson(bytes, format);
  if (!json) return null;
  for (const extension of json.extensionsRequired ?? []) {
    const compression = COMPRESSIONS[extension];
    if (compression) return { kind: 'compressed', compression };
  }
  const missing = externalBuffers(json).find((file) => !companions.has(file));
  return missing === undefined ? null : { kind: 'externalData', file: missing };
}

/** The files a glTF keeps its geometry in, beside it, by the names it gives them; none for a self-contained one. */
export function gltfCompanions(bytes: Uint8Array, format: ModelFormat): string[] {
  if (format !== 'gltf' && format !== 'glb') return [];
  const json = readJson(bytes, format);
  return json ? externalBuffers(json) : [];
}

/** The buffers' files, as named: a buffer list or a `uri` that isn't what glTF writes names none (the loader then reports it). */
function externalBuffers(json: GltfJson): string[] {
  const buffers: unknown[] = Array.isArray(json.buffers) ? json.buffers : [];
  const uris = buffers.flatMap((buffer) => {
    const uri = (buffer as { uri?: unknown } | null)?.uri;
    return typeof uri === 'string' && !uri.startsWith('data:') ? [decodedUri(uri)] : [];
  });
  return [...new Set(uris)];
}

/**
 * The image a glTF texture shows (`textures[i].source`, or an image extension's source), as an index in `images`;
 * null when the JSON doesn't say.
 */
export function gltfTextureImage(json: unknown, textureIndex: number): number | null {
  const textures = (json as GltfJson | null)?.textures;
  const texture = Array.isArray(textures) ? (textures[textureIndex] as { source?: unknown; extensions?: Record<string, { source?: unknown }> } | undefined) : undefined;
  const sources = [texture?.source, ...IMAGE_EXTENSIONS.map((name) => texture?.extensions?.[name]?.source)];
  const source = sources.find((candidate): candidate is number => Number.isInteger(candidate));
  return source ?? null;
}

/** Where a glTF image's bytes are: in the file itself (a buffer view, a `data:` URI), or in a file at a path beside it. */
export type GltfImagePlace = { kind: 'inFile' } | { kind: 'beside'; path: string };

export function gltfImagePlace(json: unknown, image: number): GltfImagePlace | null {
  const images = (json as GltfJson | null)?.images;
  const definition = Array.isArray(images) ? (images[image] as { uri?: unknown; bufferView?: unknown } | undefined) : undefined;
  if (!definition) return null;
  if (typeof definition.uri === 'string') return definition.uri.startsWith('data:') ? { kind: 'inFile' } : { kind: 'beside', path: decodedUri(definition.uri) };
  return Number.isInteger(definition.bufferView) ? { kind: 'inFile' } : null;
}

const GLB_BINARY_CHUNK = 0x004e4942;
const IMAGE_EXTENSIONS_BY_TYPE: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/ktx2': 'ktx2', 'image/avif': 'avif' };

/** An image a glTF holds, by its index: its bytes and a file name whose extension tells their format; null if none. */
export type GltfImages = (image: number) => { bytes: Uint8Array; name: string } | null;

/** Each version's images, by its bytes and companions: its JSON read and its buffers decoded once. */
const imagesOfBytes = new WeakMap<Uint8Array, { companions: Readonly<Record<string, Uint8Array>>; images: GltfImages }>();

/**
 * The images a glTF holds (in a buffer view of its binary chunk, of a `data:` buffer, or of a buffer in a companion
 * file; or a `data:` URI of their own), read once per version: its JSON parsed and each buffer decoded once, however
 * many of its images are asked for. An image of a buffer is a view of it, never copied; a `data:` URI is decoded into
 * bytes of its own once. None for an image in a file of its own, or one that doesn't read.
 */
export function gltfImagesOf(bytes: Uint8Array, format: ModelFormat, companions: Readonly<Record<string, Uint8Array>> = {}): GltfImages {
  const kept = imagesOfBytes.get(bytes);
  if (kept && kept.companions === companions) return kept.images;
  const images = readImages(bytes, format, companions);
  imagesOfBytes.set(bytes, { companions, images });
  return images;
}

/** One image a glTF holds (`gltfImagesOf`, which reads a version's once). */
export function gltfImageBytes(bytes: Uint8Array, format: ModelFormat, image: number, companions: Readonly<Record<string, Uint8Array>> = {}): { bytes: Uint8Array; name: string } | null {
  return gltfImagesOf(bytes, format, companions)(image);
}

function readImages(bytes: Uint8Array, format: ModelFormat, companions: Readonly<Record<string, Uint8Array>>): GltfImages {
  if (format !== 'gltf' && format !== 'glb') return () => null;
  const json = readJson(bytes, format);
  if (!json) return () => null;
  const buffers = new Map<number, Uint8Array | null>();
  const bufferOf = (index: number): Uint8Array | null => {
    if (!buffers.has(index)) buffers.set(index, bufferBytes(bytes, format, json, index, companions));
    return buffers.get(index)!;
  };
  return (image) => {
    const images = json.images;
    const definition = Array.isArray(images) ? (images[image] as { uri?: unknown; bufferView?: unknown; mimeType?: unknown } | undefined) : undefined;
    if (!definition) return null;
    try {
      if (typeof definition.uri === 'string') {
        const data = dataUri(definition.uri);
        return data && { bytes: data.bytes, name: `image.${IMAGE_EXTENSIONS_BY_TYPE[data.type] ?? 'bin'}` };
      }
      const view = Array.isArray(json.bufferViews) ? (json.bufferViews[definition.bufferView as number] as { buffer?: number; byteOffset?: number; byteLength?: number } | undefined) : undefined;
      const buffer = view && bufferOf(view.buffer ?? 0);
      if (!view || !buffer || typeof view.byteLength !== 'number') return null;
      const start = view.byteOffset ?? 0;
      if (start + view.byteLength > buffer.length) return null;
      return { bytes: buffer.subarray(start, start + view.byteLength), name: `image.${IMAGE_EXTENSIONS_BY_TYPE[String(definition.mimeType)] ?? 'bin'}` };
    } catch {
      return null;
    }
  };
}

/** A glTF buffer's bytes: a GLB's binary chunk, a `data:` URI decoded, or the companion file its URI names. */
function bufferBytes(bytes: Uint8Array, format: 'gltf' | 'glb', json: GltfJson, index: number, companions: Readonly<Record<string, Uint8Array>>): Uint8Array | null {
  const buffer = Array.isArray(json.buffers) ? (json.buffers[index] as { uri?: unknown } | undefined) : undefined;
  if (!buffer) return null;
  try {
    if (typeof buffer.uri === 'string') return buffer.uri.startsWith('data:') ? (dataUri(buffer.uri)?.bytes ?? null) : (companions[decodedUri(buffer.uri)] ?? null);
    return format === 'glb' && index === 0 ? glbBinaryChunk(bytes) : null;
  } catch {
    return null;
  }
}

function dataUri(uri: string): { type: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!match) return null;
  const text = match[2] ? atob(match[3]!) : decodedUri(match[3]!);
  return { type: match[1]!, bytes: Uint8Array.from(text, (character) => character.charCodeAt(0)) };
}

/** A GLB's second chunk, its binary buffer, after the JSON chunk (padded to 4 bytes). */
function glbBinaryChunk(bytes: Uint8Array): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES + view.getUint32(GLB_HEADER_BYTES, true);
  if (at + GLB_CHUNK_HEADER_BYTES > bytes.length || view.getUint32(at + 4, true) !== GLB_BINARY_CHUNK) return null;
  const length = view.getUint32(at, true);
  return bytes.subarray(at + GLB_CHUNK_HEADER_BYTES, at + GLB_CHUNK_HEADER_BYTES + length);
}

/** A URI's file name, `%20` as a space; one that isn't validly encoded (`100%.bin`) as written. */
function decodedUri(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

function readJson(bytes: Uint8Array, format: 'gltf' | 'glb'): GltfJson | null {
  try {
    return JSON.parse(new TextDecoder().decode(format === 'glb' ? glbJsonChunk(bytes) : bytes)) as GltfJson;
  } catch {
    return null;
  }
}

/** A GLB's first chunk, its JSON: after the 12-byte header, a chunk's length and type, then its bytes. */
function glbJsonChunk(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(GLB_HEADER_BYTES, true);
  if (view.getUint32(GLB_HEADER_BYTES + 4, true) !== GLB_JSON_CHUNK) throw new Error('No JSON chunk');
  const start = GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES;
  return bytes.subarray(start, start + length);
}
