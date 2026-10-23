import type { MovePair } from '@shared/domain/pendingChanges';
import { comparedLines, sizeSimilarity, textSimilarity } from './moveSimilarity';

/** Past this, a text file isn't scored: the larger the files, the longer their diff, and Search matches waits for it. */
export const MAX_SCORED_TEXT_BYTES = 4 * 1024 * 1024;

/** New files read from disk at once: enough to keep the disk busy, few enough to hold little memory. */
const READS_AT_ONCE = 16;

export interface SimilarityReads {
  /**
   * The loaded revision of a deleted text file, null where it can't be read. Every one is asked before any is awaited,
   * so a reader that batches (`RevisionCat`) reads them with one `cm cat`.
   */
  readDeleted: (path: string) => Promise<Buffer | null>;
  /** A new file from disk, null where it can't be read. */
  readAdded: (path: string) => Promise<Buffer | null>;
  /** Lets the main process answer other calls between pairs: thousands of diffs would hold it otherwise. */
  yieldNow?: () => Promise<void>;
}

/**
 * Each pair's similarity (`moveSimilarity`), in their order; null for what `cm`'s move detection doesn't pair (a
 * folder, a text file with a binary one: its `DataType`s must be the same) and for a file too large or unreadable.
 * Binary files take their sizes and read nothing.
 */
export async function measureMoveSimilarities(pairs: readonly MovePair[], reads: SimilarityReads): Promise<(number | null)[]> {
  const textPairs = pairs.filter(isScoredText);
  const deletedLines = linesOf(unique(textPairs.map((pair) => pair.deleted.path)), reads.readDeleted, Infinity);
  const addedLines = linesOf(unique(textPairs.map((pair) => pair.added.path)), reads.readAdded, READS_AT_ONCE);
  const [deleted, added] = await Promise.all([deletedLines, addedLines]);
  const yieldNow = reads.yieldNow ?? (() => new Promise<void>((resolve) => setImmediate(resolve)));

  const similarities: (number | null)[] = [];
  for (const pair of pairs) {
    if (isScoredText(pair)) {
      const from = deleted.get(pair.deleted.path);
      const to = added.get(pair.added.path);
      similarities.push(from && to ? textSimilarity(from, to) : null);
      await yieldNow();
    } else {
      similarities.push(isScoredBinary(pair) ? sizeSimilarity(pair.deleted.size, pair.added.size) : null);
    }
  }
  return similarities;
}

function isScoredText({ deleted, added }: MovePair): boolean {
  return deleted.itemType === 'file' && added.itemType === 'file' && deleted.size <= MAX_SCORED_TEXT_BYTES && added.size <= MAX_SCORED_TEXT_BYTES;
}

function isScoredBinary({ deleted, added }: MovePair): boolean {
  return deleted.itemType === 'binaryFile' && added.itemType === 'binaryFile';
}

/** Each path's compared lines, `atOnce` read at a time; a path that couldn't be read is left out. */
async function linesOf(paths: readonly string[], read: (path: string) => Promise<Buffer | null>, atOnce: number): Promise<Map<string, string[]>> {
  const lines = new Map<string, string[]>();
  let next = 0;
  const readNext = async (): Promise<void> => {
    while (next < paths.length) {
      const path = paths[next++]!;
      const bytes = await read(path).catch(() => null);
      if (bytes && bytes.length <= MAX_SCORED_TEXT_BYTES) lines.set(path, comparedLines(textOf(bytes)));
    }
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, paths.length) }, readNext));
  return lines;
}

/** UTF-8, its byte order mark left out: a file saved with one compares equal to the same file without. */
function textOf(bytes: Buffer): string {
  const text = bytes.toString('utf8');
  return text.startsWith('﻿') ? text.slice(1) : text;
}

function unique(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}
