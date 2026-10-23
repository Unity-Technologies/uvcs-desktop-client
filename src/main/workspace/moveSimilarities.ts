import { extname } from 'node:path';
import type { MovePair, MoveSimilarity } from '@shared/domain/pendingChanges';
import type { DeletedFile } from '../cm/deletedFiles';
import { comparedLines, sizeSimilarity, textSimilarity } from './moveSimilarity';

/** Past this, a text file isn't measured: the larger the files, the longer their diff, and Search matches waits for it. */
export const MAX_SCORED_TEXT_BYTES = 4 * 1024 * 1024;

/** New files read from disk at once: enough to keep the disk busy, few enough to hold little memory. */
const READS_AT_ONCE = 16;

/** A new file's size, and whether its start holds what text doesn't (`looksBinary`). */
export interface FileGlance {
  size: number;
  isBinary: boolean;
}

export interface SimilarityReads {
  /** Every deleted file's loaded revision, kind and size, with one listing (`cm ls`); a path it can't tell is left out. */
  listDeleted: (paths: readonly string[]) => Promise<Map<string, DeletedFile>>;
  /**
   * A deleted text file's loaded revision, null where it can't be read. Every one is asked before any is awaited, so a
   * reader that batches (`RevisionCat`) reads them together.
   */
  readDeleted: (file: DeletedFile) => Promise<Buffer | null>;
  /** A new file's size and kind, from its start: a binary one is measured by its size alone, never read whole. */
  glanceAtAdded: (path: string) => Promise<FileGlance | null>;
  /** A new text file, whole. */
  readAdded: (path: string) => Promise<Buffer | null>;
  /** Told once what couldn't be read, to say so where it can be seen: every pair then reads `notMeasured` silently. */
  onUnreadable?: (path: string, error: unknown) => void;
  /** Lets the main process answer other calls between pairs: hundreds of diffs would hold it otherwise. */
  yieldNow?: () => Promise<void>;
}

/** What a pair's measure takes of a file: its kind and size, and a text file's compared lines (none past the cap). */
interface Measured {
  isBinary: boolean;
  size: number;
  lines?: string[];
}

/**
 * Each pair's similarity, in their order, as `cm`'s move detection pairs and measures files (`FileChangesMatcher`):
 * text with text by their lines, binary with binary of one extension by their sizes (`bBinMatchingOnlySameExtension`),
 * any other pair `notPairable`. A deleted file's kind and size are `cm`'s (`listDeleted`), and only its text is read;
 * a new file, which `cm` has no revision of, is told by its content.
 */
export async function measureMoveSimilarities(pairs: readonly MovePair[], reads: SimilarityReads): Promise<MoveSimilarity[]> {
  const [deleted, added] = await Promise.all([measureDeleted(unique(pairs.map((pair) => pair.deleted)), reads), measureAllAdded(unique(pairs.map((pair) => pair.added)), reads)]);
  const yieldNow = reads.yieldNow ?? (() => new Promise<void>((resolve) => setImmediate(resolve)));

  const similarities: MoveSimilarity[] = [];
  for (const pair of pairs) {
    similarities.push(similarityOf(pair, deleted.get(pair.deleted), added.get(pair.added)));
    await yieldNow();
  }
  return similarities;
}

function similarityOf(pair: MovePair, deleted: Measured | undefined, added: Measured | undefined): MoveSimilarity {
  if (!deleted || !added) return 'notMeasured';
  if (deleted.isBinary !== added.isBinary) return 'notPairable';
  if (deleted.isBinary) return sameExtension(pair.deleted, pair.added) ? sizeSimilarity(deleted.size, added.size) : 'notPairable';
  if (!deleted.lines || !added.lines) return 'notMeasured';
  return textSimilarity(deleted.lines, added.lines) ?? 'notMeasured';
}

/** The deleted files as `cm` lists them, the text ones under the cap read, all asked at once. */
async function measureDeleted(paths: readonly string[], reads: SimilarityReads): Promise<Map<string, Measured>> {
  const measured = new Map<string, Measured>();
  if (paths.length === 0) return measured;
  const listed = await reads.listDeleted(paths).catch((error: unknown) => {
    reads.onUnreadable?.(paths.join(', '), error);
    return new Map<string, DeletedFile>();
  });
  await Promise.all(
    paths.map(async (path) => {
      const file = listed.get(path.normalize('NFC'));
      if (!file) return;
      if (file.isBinary || file.size > MAX_SCORED_TEXT_BYTES) return void measured.set(path, { isBinary: file.isBinary, size: file.size });
      const bytes = await read(path, () => reads.readDeleted(file), reads);
      if (bytes) measured.set(path, { isBinary: false, size: file.size, lines: comparedLines(textOf(bytes)) });
    }),
  );
  return measured;
}

/** The new files, `READS_AT_ONCE` at a time: each one glanced at, and read whole only when it's text under the cap. */
async function measureAllAdded(paths: readonly string[], reads: SimilarityReads): Promise<Map<string, Measured>> {
  const measured = new Map<string, Measured>();
  let next = 0;
  const measureNext = async (): Promise<void> => {
    while (next < paths.length) {
      const path = paths[next++]!;
      const glance = await read(path, () => reads.glanceAtAdded(path), reads);
      if (!glance) continue;
      if (glance.isBinary || glance.size > MAX_SCORED_TEXT_BYTES) {
        measured.set(path, glance);
        continue;
      }
      const bytes = await read(path, () => reads.readAdded(path), reads);
      if (bytes) measured.set(path, { isBinary: false, size: bytes.length, lines: comparedLines(textOf(bytes)) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(READS_AT_ONCE, paths.length) }, measureNext));
  return measured;
}

/** A read, its failure told (`onUnreadable`) and taken as nothing read, a reader's own throw too. */
function read<T>(path: string, reading: () => Promise<T | null>, reads: SimilarityReads): Promise<T | null> {
  return Promise.resolve().then(reading).catch((error: unknown) => {
    reads.onUnreadable?.(path, error);
    return null;
  });
}

function sameExtension(a: string, b: string): boolean {
  return extname(a).toLowerCase() === extname(b).toLowerCase();
}

const BYTE_ORDER_MARK = '\uFEFF';

/** UTF-8, its byte order mark left out: a file saved with one compares equal to the same file without. */
function textOf(bytes: Buffer): string {
  const text = bytes.toString('utf8');
  return text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
}

function unique(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}
