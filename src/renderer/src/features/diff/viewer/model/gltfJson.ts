// What a glTF needs besides its own bytes, read from its JSON before three parses it: a `.gltf` keeps its geometry in
// a `.bin` file next to it more often than inline, and a compressed one needs a decoder the viewer doesn't ship.

import type { ModelFormat } from '@shared/domain/content';

/** Why a glTF can't be shown from its bytes alone. */
export type GltfNeed = { kind: 'externalData'; file: string } | { kind: 'compressed'; compression: 'Draco' | 'meshopt' };

interface GltfJson {
  buffers?: unknown;
  extensionsRequired?: string[];
}

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
