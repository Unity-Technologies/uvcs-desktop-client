// Texture files read and decoded for the Materials look, once per version of each file: keyed by its path, size and
// when it was written (and how it's drawn), so the same texture used by both versions of a model, by several slots, or
// by the next model, decodes once. Bytes are read from the workspace on disk (`api.content.readBytes`) and handed to
// the texture worker; only the decoded bitmaps are kept, the latest few hundred megabytes of them.

import type { FoundFile } from '@shared/domain/unityAssets';
import { api } from '../../../../../api/client';
import type { TextureDecoded } from './decodeTexture';
import { MAX_TEXTURE_FILE_BYTES } from './textureBudget';
import { decodeOffThread } from './textureWorkerSession';

/** Where a texture's bytes come from: a workspace file, or bytes already at hand (an image a glTF holds). */
export type TextureBytes = { kind: 'workspaceFile'; file: FoundFile } | { kind: 'bytes'; bytes: Uint8Array; id: string };

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
const KEPT_BYTES = 384 * 1024 * 1024;
const decodes = new Map<string, { decoded: Promise<TextureDecoded>; bytes: number }>();

export function textureKey(workspacePath: string, load: Omit<TextureLoad, 'key'>): string {
  const of = load.source.kind === 'workspaceFile' ? `${load.source.file.path}\0${load.source.file.size}\0${load.source.file.modified}` : load.source.id;
  return [workspacePath, of, load.longest, load.flipY].join('\0');
}

/** The texture decoded, from the one decode of the same file version if there was one. */
export function loadTexture(workspacePath: string, load: TextureLoad): Promise<TextureDecoded> {
  const kept = decodes.get(load.key);
  if (kept) {
    // Most recently used last: the first ones go when there are too many.
    decodes.delete(load.key);
    decodes.set(load.key, kept);
    return kept.decoded;
  }
  const entry = { decoded: readAndDecode(workspacePath, load), bytes: load.longest * load.longest * 4 };
  decodes.set(load.key, entry);
  void entry.decoded.then((decoded) => {
    if (decoded.kind === 'decoded') entry.bytes = decoded.bitmap.width * decoded.bitmap.height * 4;
    else if (decoded.problem === 'unreadable') decodes.delete(load.key);
    letGoOfOldest();
  });
  return entry.decoded;
}

async function readAndDecode(workspacePath: string, load: TextureLoad): Promise<TextureDecoded> {
  const bytes = load.source.kind === 'bytes' ? load.source.bytes.slice() : await readWorkspaceFile(workspacePath, load.source.file);
  if (!(bytes instanceof Uint8Array)) return bytes;
  return decodeOffThread({ bytes, name: load.name, longest: load.longest, flipY: load.flipY });
}

async function readWorkspaceFile(workspacePath: string, file: FoundFile): Promise<Uint8Array | TextureDecoded> {
  if (file.size > MAX_TEXTURE_FILE_BYTES) return { kind: 'failed', problem: 'tooLarge' };
  try {
    const bytes = await api.content.readBytes(workspacePath, { kind: 'workspaceFile', path: file.path });
    return bytes ?? { kind: 'failed', problem: 'missing' };
  } catch (error) {
    // The read refuses a file past its size cap unread.
    return { kind: 'failed', problem: error instanceof Error && /too large/i.test(error.message) ? 'tooLarge' : 'unreadable' };
  }
}

/** Drops the least recently used decodes past the bytes kept; a bitmap still drawn stays alive through its texture. */
function letGoOfOldest(): void {
  let total = 0;
  for (const entry of decodes.values()) total += entry.bytes;
  for (const [key, entry] of decodes) {
    if (total <= KEPT_BYTES) return;
    decodes.delete(key);
    total -= entry.bytes;
  }
}
