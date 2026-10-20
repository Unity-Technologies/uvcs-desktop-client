// Texture files read and decoded for the Materials look, once per version of each file: keyed by it (`foundFileKey`:
// a disk file's path, size and time written, a repository's revision) and how it's drawn, so the same texture used by
// both versions of a model, by several slots, or by the next model, decodes once. Bytes are read where the file was
// found (`api.unityAssets.read`: the disk, or its revision, downloaded) and handed to the image decoding worker, a few
// at a time (`TEXTURES_IN_HAND`); only the decoded bitmaps are kept (`decodes`).

import { concurrencyLimit } from '@shared/concurrencyLimit';
import { downloadedAheadBytesOf, foundFileKey, MAX_DOWNLOADED_AHEAD_BYTES, type FoundFile } from '@shared/domain/unityAssets';
import { api } from '../../../../../api/client';
import type { TextureDecoded } from './decodeTexture';
import { MAX_TEXTURE_FILE_BYTES } from './textureBudget';
import { DecodeCache } from './decodeCache';
import { decodeOffThread } from '../../imageDecoding/imageDecodingSession';

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

/**
 * The decoded bitmaps, by the pixels they hold (four bytes each): those the viewers show (`holdTextures`), and the
 * latest 192 MB besides, for the next model, until no viewer has shown any for a while. A bitmap let go of is closed
 * at once: its pixels are freed then, not whenever its object is collected.
 */
const decodes = new DecodeCache<Promise<TextureDecoded>>({
  keptBytes: 192 * 1024 * 1024,
  release: (decoded) => void decoded.then((result) => result.kind === 'decoded' && result.bitmap.close()),
  emptiedAfterMs: 30_000,
});

/** Holds the textures a viewer shows (by `TextureLoad.key`) until it lets go of them: none is closed meanwhile. */
export function holdTextures(keys: Iterable<string>): () => void {
  return decodes.hold(keys);
}

/**
 * The textures read and decoded at once: each holds its file's bytes from its read until the worker has them, then
 * its pixels as it decodes. Reading all of a model's at once held every file in both processes (forty 4K PNGs, 1.2
 * GB, read together). Three: one is read while the decoding worker has two in hand (`decodeOffThread`); the worker's two
 * are shared with the image diff's paints (`imageDecodingSession`), so a texture may wait behind an image there.
 */
export const TEXTURES_IN_HAND = 3;
const inHand = concurrencyLimit(TEXTURES_IN_HAND);

/** What a load the cache let go of before its turn resolves to: no viewer awaits it. */
const LET_GO_OF: TextureDecoded = { kind: 'failed', problem: 'unreadable' };

export function textureKey(workspacePath: string, load: Omit<TextureLoad, 'key'>): string {
  const of = load.source.kind === 'found' ? foundFileKey(load.source.file) : load.source.id;
  return [workspacePath, of, load.longest, load.flipY].join('\0');
}

/**
 * Each load's texture decoded, in the order asked. The repository's files not decoded yet are asked to download first,
 * in one batch (`api.unityAssets.download`): read a few at a time, they would each go in a `cm cat` of their own. At
 * most `MAX_DOWNLOADED_AHEAD_BYTES` at a time, so what one look downloaded is still kept when it is read: the next
 * part is asked for as the first texture in it comes up.
 */
export function loadTextures(workspacePath: string, loads: readonly TextureLoad[]): Promise<TextureDecoded>[] {
  const downloads = new Map<string, FoundFile>();
  for (const { key, source } of loads) {
    if (source.kind === 'found' && source.file.stored === 'repository' && source.file.size <= MAX_TEXTURE_FILE_BYTES && !decodes.has(key)) downloads.set(foundFileKey(source.file), source.file);
  }
  const askFor = new Map<string, () => void>();
  for (const part of partsOf([...downloads.values()], MAX_DOWNLOADED_AHEAD_BYTES)) {
    let asked = false;
    const ask = (): void => {
      if (asked) return;
      asked = true;
      // A download that fails is told by its read.
      api.unityAssets.download(workspacePath, part).catch(() => undefined);
    };
    for (const file of part) askFor.set(foundFileKey(file), ask);
  }
  const [first] = askFor.values();
  first?.();
  return loads.map((load) => loadTexture(workspacePath, load, (load.source.kind === 'found' && askFor.get(foundFileKey(load.source.file))) || NOTHING_TO_ASK));
}

const NOTHING_TO_ASK = (): void => undefined;

/** The files in parts of at most `maxBytes` (`downloadedAheadBytesOf`), in order; one bigger than that alone. */
function partsOf(files: readonly FoundFile[], maxBytes: number): FoundFile[][] {
  const parts: FoundFile[][] = [];
  let bytes = 0;
  for (const file of files) {
    const size = downloadedAheadBytesOf(file);
    const last = parts.at(-1);
    if (last && bytes + size <= maxBytes) {
      last.push(file);
      bytes += size;
    } else {
      parts.push([file]);
      bytes = size;
    }
  }
  return parts;
}

/** The texture decoded, from the one decode of the same file version if there was one; `askForDownload` as it is read. */
function loadTexture(workspacePath: string, load: TextureLoad, askForDownload: () => void): Promise<TextureDecoded> {
  const kept = decodes.get(load.key);
  if (kept) return kept;
  // Its turn come, a load the cache let go of meanwhile (no viewer holds it, and it went past the budget or a while
  // after the last viewer) reads nothing. One whose turn comes at once was just asked for, before the cache has it.
  let decoded: Promise<TextureDecoded> | undefined;
  decoded = inHand(() => (decoded === undefined || decodes.peek(load.key) === decoded ? readAndDecode(workspacePath, load, askForDownload) : Promise.resolve(LET_GO_OF)));
  // Sized as at most the budget's side until it is known; a decode that failed to read is tried again next time.
  decodes.set(load.key, decoded, load.longest * load.longest * 4);
  void decoded.then((result) => {
    // Let go of, or another decode of the key took its place: nothing of the cache is this one's to change.
    if (decodes.peek(load.key) !== decoded) return;
    if (result.kind === 'decoded') decodes.resize(load.key, result.bitmap.width * result.bitmap.height * 4);
    else if (result.problem === 'unreadable') decodes.delete(load.key);
  });
  return decoded;
}

async function readAndDecode(workspacePath: string, load: TextureLoad, askForDownload: () => void): Promise<TextureDecoded> {
  askForDownload();
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
