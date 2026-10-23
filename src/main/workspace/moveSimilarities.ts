import { extname } from 'node:path';
import type { MovePair, MoveSimilarity } from '@shared/domain/pendingChanges';
import { looksBinary } from '../files/fileContent';
import { comparedLines, sizeSimilarity, textSimilarity } from './moveSimilarity';

/** Past this, a text file isn't measured: the larger the files, the longer their diff, and Search matches waits for it. */
export const MAX_SCORED_TEXT_BYTES = 4 * 1024 * 1024;

/** New files read from disk at once: enough to keep the disk busy, few enough to hold little memory. */
const READS_AT_ONCE = 16;

/** A new file's size, and whether its start holds what text never does (`looksBinary`). */
export interface FileGlance {
  size: number;
  isBinary: boolean;
}

export interface SimilarityReads {
  /**
   * The loaded revision of a deleted file, null where it can't be read. Every one is asked before any is awaited, so a
   * reader that batches (`RevisionCat`) reads them with one `cm cat`.
   */
  readDeleted: (path: string) => Promise<Buffer | null>;
  /** A new file's size and kind, from its start: a binary one is measured by its size alone, never read whole. */
  glanceAtAdded: (path: string) => Promise<FileGlance | null>;
  /** A new text file, whole. */
  readAdded: (path: string) => Promise<Buffer | null>;
  /** Lets the main process answer other calls between pairs: thousands of diffs would hold it otherwise. */
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
 * any other pair `notPairable`. Changes doesn't know a file's kind (`cm status --machinereadable` prints none), so it
 * is told from the content, as `cm` tells it when no rule names it.
 */
export async function measureMoveSimilarities(pairs: readonly MovePair[], reads: SimilarityReads): Promise<MoveSimilarity[]> {
  const [deleted, added] = await Promise.all([
    measureAll(unique(pairs.map((pair) => pair.deleted)), Infinity, async (path) => measuredOfBytes(await reads.readDeleted(path))),
    measureAll(unique(pairs.map((pair) => pair.added)), READS_AT_ONCE, (path) => measureAdded(path, reads)),
  ]);
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
  return deleted.lines && added.lines ? textSimilarity(deleted.lines, added.lines) : 'notMeasured';
}

async function measureAdded(path: string, reads: SimilarityReads): Promise<Measured | null> {
  const glance = await reads.glanceAtAdded(path);
  if (!glance || glance.isBinary || glance.size > MAX_SCORED_TEXT_BYTES) return glance;
  const bytes = await reads.readAdded(path);
  return bytes && { isBinary: false, size: bytes.length, lines: comparedLines(textOf(bytes)) };
}

function measuredOfBytes(bytes: Buffer | null): Measured | null {
  if (!bytes) return null;
  const isBinary = looksBinary(bytes);
  const lines = isBinary || bytes.length > MAX_SCORED_TEXT_BYTES ? undefined : comparedLines(textOf(bytes));
  return { isBinary, size: bytes.length, lines };
}

/** Each path measured, `atOnce` at a time; a path that couldn't be read is left out. */
async function measureAll(paths: readonly string[], atOnce: number, measure: (path: string) => Promise<Measured | null>): Promise<Map<string, Measured>> {
  const measured = new Map<string, Measured>();
  let next = 0;
  const measureNext = async (): Promise<void> => {
    while (next < paths.length) {
      const path = paths[next++]!;
      const result = await measure(path).catch(() => null);
      if (result) measured.set(path, result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(atOnce, paths.length) }, measureNext));
  return measured;
}

function sameExtension(a: string, b: string): boolean {
  return extname(a).toLowerCase() === extname(b).toLowerCase();
}

/** UTF-8, its byte order mark left out: a file saved with one compares equal to the same file without. */
function textOf(bytes: Buffer): string {
  const text = bytes.toString('utf8');
  return text.startsWith('﻿') ? text.slice(1) : text;
}

function unique(paths: readonly string[]): string[] {
  return [...new Set(paths)];
}
