import type { ContentSource, FileContent } from '@shared/domain/content';
import type { ConflictedFile } from './useFileConflicts';

/** One version of a conflicting file as far as it has been read. */
export interface VersionRead {
  data?: FileContent;
  error: Error | null;
}

/** A known binary's three versions before the user opens it: none read. */
const NOT_READ: readonly VersionRead[] = [{ error: null }, { error: null }, { error: null }];

/** The versions read as the page opens, three a file in the files' order, and where each file's three start. */
export interface UpFrontReads {
  sources: ContentSource[];
  firstOf: ReadonlyMap<string, number>;
}

/**
 * The versions read as the page opens: the three of every file whose status needs its automatic merge. A file known
 * to be a binary (`isKnownBinary`) needs a decision whatever its bytes hold: none of its versions is read up front,
 * though each may weigh hundreds of MB (textures, models, scenes).
 */
export function upFrontReads(files: readonly ConflictedFile[]): UpFrontReads {
  const sources: ContentSource[] = [];
  const firstOf = new Map<string, number>();
  for (const file of files) {
    if (file.isKnownBinary) continue;
    firstOf.set(file.key, sources.length);
    sources.push(file.base, file.source, file.destination);
  }
  return { sources, firstOf };
}

/** The versions read once the user opens the file: a known binary's three, to show and pick from; none for the others. */
export function readsOnOpen(file: ConflictedFile | undefined): ContentSource[] {
  return file?.isKnownBinary ? [file.base, file.source, file.destination] : [];
}

/**
 * The reads as `versionsOf` takes them, from the queries' results (`useQueries`' `combine`): a new array only when a
 * result changed, so a file's state is built again only then.
 */
export function versionReads(results: readonly VersionRead[]): VersionRead[] {
  return results.map(({ data, error }) => ({ data, error }));
}

/** A file's three versions as far as read: up front, or for a known binary, as it opened. */
export function versionsOf(
  file: ConflictedFile,
  upFront: UpFrontReads,
  upFrontResults: readonly VersionRead[],
  opened: { key: string; versions: readonly VersionRead[] } | undefined,
): readonly VersionRead[] {
  const first = upFront.firstOf.get(file.key);
  if (first !== undefined) return upFrontResults.slice(first, first + 3);
  return opened?.key === file.key && opened.versions.length === 3 ? opened.versions : NOT_READ;
}
