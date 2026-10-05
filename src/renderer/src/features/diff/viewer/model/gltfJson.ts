// What a glTF needs besides its own bytes, read from its JSON before three parses it: a `.gltf` keeps its geometry in
// a `.bin` file next to it more often than inline, and a compressed one needs a decoder the viewer doesn't ship.

import type { ModelFormat } from '@shared/domain/content';

/** Why a glTF can't be shown from its bytes alone. */
export type GltfNeed = { kind: 'externalData'; file: string } | { kind: 'compressed'; compression: 'Draco' | 'meshopt' };

interface GltfJson {
  buffers?: { uri?: string }[];
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

/** What the glTF needs that its bytes don't hold, or null when they're enough. A JSON that doesn't read is the loader's to report. */
export function gltfNeed(bytes: Uint8Array, format: Extract<ModelFormat, 'gltf' | 'glb'>): GltfNeed | null {
  const json = readJson(bytes, format);
  if (!json) return null;
  for (const extension of json.extensionsRequired ?? []) {
    const compression = COMPRESSIONS[extension];
    if (compression) return { kind: 'compressed', compression };
  }
  const external = (json.buffers ?? []).find((buffer) => buffer.uri !== undefined && !buffer.uri.startsWith('data:'));
  return external?.uri ? { kind: 'externalData', file: decodeURIComponent(external.uri) } : null;
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
