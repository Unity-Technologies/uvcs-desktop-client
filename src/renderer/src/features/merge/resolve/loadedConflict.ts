import type { FileContent } from '@shared/domain/content';
import type { VersionRead } from './conflictVersionReads';
import { buildConflictDocument, type ConflictDocument, type ConflictLabels } from './threeWayMerge';

export interface ConflictContents {
  base: FileContent;
  source: FileContent;
  destination: FileContent;
}

/**
 * A conflicting file as far as its three versions have loaded, merged automatically once they all have. A known binary
 * is ready before any is read: `contents` once they are, `error` when they couldn't be.
 */
export type LoadedConflict =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; contents?: ConflictContents; labels: ConflictLabels; document?: ConflictDocument; error?: Error };

/**
 * The file from its versions (base, source, destination). Merging is the expensive part, and the versions of hundreds
 * of files load one after the other: a file whose versions and labels are the ones `previous` merged keeps that merge.
 * A file known to be a binary (`knownBinary`) is never merged: it waits for a decision whether its versions are read.
 */
export function loadConflict(versions: readonly VersionRead[], labels: ConflictLabels, previous?: LoadedConflict, knownBinary = false): LoadedConflict {
  if (knownBinary) return loadBinary(versions, labels, previous);

  const error = readError(versions);
  if (error) return { status: 'error', error };

  const contents = contentsOf(versions);
  if (!contents) return { status: 'loading' };
  if (previous?.status === 'ready' && previous.labels === labels && sameContents(previous.contents, contents)) return previous;

  const { base, source, destination } = contents;
  const isBinary = base.isBinary || source.isBinary || destination.isBinary;
  return {
    status: 'ready',
    contents,
    labels,
    document: isBinary ? undefined : buildConflictDocument(base.text ?? '', source.text ?? '', destination.text ?? '', labels),
  };
}

/** A known binary: ready for a decision at once, with its versions once read (the user opened it) or why they weren't. */
function loadBinary(versions: readonly VersionRead[], labels: ConflictLabels, previous: LoadedConflict | undefined): LoadedConflict {
  const error = readError(versions);
  const contents = error ? undefined : contentsOf(versions);
  if (previous?.status === 'ready' && previous.labels === labels && previous.error === error && sameContents(previous.contents, contents)) return previous;
  return { status: 'ready', labels, ...(contents && { contents }), ...(error && { error }) };
}

/**
 * Why the versions can't be merged: a read that failed, or a version whose content was purged (`FileContent.purged`),
 * which would merge as an empty text, the file emptied. Decided here, where the merge takes the versions, not in their
 * read: the diff of a version reads the same query and keeps a purged one as an answer. One error, so a file's state
 * stays the one built while it does.
 */
function readError(versions: readonly VersionRead[]): Error | undefined {
  return versions.find((version) => version.error)?.error ?? (versions.some((version) => version.data?.purged) ? PURGED_VERSION_ERROR : undefined);
}

/** Why a file one of whose versions was purged can't be merged. */
export const UNMERGEABLE_PURGED_MESSAGE = "A version of this file was purged from the server, so it can't be merged.";
const PURGED_VERSION_ERROR = new Error(UNMERGEABLE_PURGED_MESSAGE);

function contentsOf(versions: readonly VersionRead[]): ConflictContents | undefined {
  const [base, source, destination] = versions.map((version) => version.data);
  return base && source && destination ? { base, source, destination } : undefined;
}

function sameContents(a: ConflictContents | undefined, b: ConflictContents | undefined): boolean {
  if (!a || !b) return a === b;
  return a.base === b.base && a.source === b.source && a.destination === b.destination;
}
