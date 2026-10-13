// Texture files read and decoded for the Materials look, once per version of each file: keyed by it (`foundFileKey`:
// a disk file's path, size and time written, a repository's revision) and how it's drawn, so the same texture used by
// both versions of a model, by several slots, or by the next model, decodes once. Bytes are read where the file was
// found (`api.unityAssets.read`: the disk, or its revision, downloaded) and handed to the texture worker; only the
// decoded bitmaps are kept, the latest few hundred megabytes of them.

import { foundFileKey, type FoundFile } from '@shared/domain/unityAssets';
import { api } from '../../../../../api/client';
import type { TextureDecoded } from './decodeTexture';
import { MAX_TEXTURE_FILE_BYTES } from './textureBudget';
import { DecodeCache } from './decodeCache';
import { decodeOffThread } from './textureWorkerSession';

/** Where a texture's bytes come from: a file found (on disk or in the repository), or bytes at hand (an image a glTF holds). */
export type TextureBytes = { kind: 'found'; file: FoundFile } | { kind: 'bytes'; bytes: Uint8Array; id: string };

export interface TextureLoad {
  /** One per file version and drawing: what the renderer keys its GPU textures by. */
  key: string;
  /** The file name, for the info strip and the format. */
  name: string;
  source: TextureBytes;
  longest: number;
  flipY: boolean;
}

/** The decoded bitmaps kept, by the pixels they hold (four bytes each). */
const decodes = new DecodeCache<Promise<TextureDecoded>>(384 * 1024 * 1024);

export function textureKey(workspacePath: string, load: Omit<TextureLoad, 'key'>): string {
  const of = load.source.kind === 'found' ? foundFileKey(load.source.file) : load.source.id;
  return [workspacePath, of, load.longest, load.flipY].join('\0');
}

/** The texture decoded, from the one decode of the same file version if there was one. */
export function loadTexture(workspacePath: string, load: TextureLoad): Promise<TextureDecoded> {
  const kept = decodes.get(load.key);
  if (kept) return kept;
  const decoded = readAndDecode(workspacePath, load);
  // Sized as at most the budget's side until it is known; a decode that failed to read is tried again next time.
  decodes.set(load.key, decoded, load.longest * load.longest * 4);
  void decoded.then((result) => {
    if (result.kind === 'decoded') decodes.resize(load.key, result.bitmap.width * result.bitmap.height * 4);
    else if (result.problem === 'unreadable') decodes.delete(load.key);
  });
  return decoded;
}

async function readAndDecode(workspacePath: string, load: TextureLoad): Promise<TextureDecoded> {
  const bytes = load.source.kind === 'bytes' ? load.source.bytes.slice() : await readFound(workspacePath, load.source.file);
  if (!(bytes instanceof Uint8Array)) return bytes;
  return decodeOffThread({ bytes, name: load.name, longest: load.longest, flipY: load.flipY });
}

async function readFound(workspacePath: string, file: FoundFile): Promise<Uint8Array | TextureDecoded> {
  if (file.size > MAX_TEXTURE_FILE_BYTES) return { kind: 'failed', problem: 'tooLarge' };
  try {
    const bytes = await api.unityAssets.read(workspacePath, file);
    return bytes ?? { kind: 'failed', problem: 'missing' };
  } catch (error) {
    // The read refuses a file past its size cap unread.
    return { kind: 'failed', problem: error instanceof Error && /too large/i.test(error.message) ? 'tooLarge' : 'unreadable' };
  }
}
