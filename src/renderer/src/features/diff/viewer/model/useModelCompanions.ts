import { useQueries } from '@tanstack/react-query';
import { useContext, useMemo, useRef } from 'react';
import type { Place } from '@shared/domain/place';
import type { ContentSource, ModelBytes } from '@shared/domain/content';
import { contentBytesQuery } from '../contentQueries';
import { gltfCompanions } from './gltfJson';
import { sameBytes } from './sameBytes';
import { SiblingFinderContext, sourcePathOf, type DiffSide } from './modelSiblings';

const NONE: Readonly<Record<string, Uint8Array>> = {};

/**
 * The reads as one, made again only when one of them changes: a function of its own, as TanStack reruns a new one each
 * render. A read that failed counts as done, without bytes: the model then says it needs the file.
 */
function combineReads(results: { isPending: boolean; isError: boolean; data?: Uint8Array | null }[]): { loading: boolean; bytes: (Uint8Array | null)[] } {
  return { loading: results.some((result) => result.isPending && !result.isError), bytes: results.map((result) => result.data ?? null) };
}

/**
 * The files a version of a model needs beside it (a glTF's `.bin`), read as the version of each that goes with it
 * (`SiblingFinderContext`), cached as any content is; null while they are being read. A file that can't be found or
 * read is left out: the model then says it needs it. A self-contained model needs none, and reads at once.
 */
export function useModelCompanions(place: Place, side: DiffSide, source: ContentSource, model: ModelBytes | undefined): Readonly<Record<string, Uint8Array>> | null {
  const findSibling = useContext(SiblingFinderContext);
  const path = sourcePathOf(source);
  const needed = useMemo(() => (model ? gltfCompanions(model.bytes, model.format) : []), [model]);
  const siblings = needed.map((name) => ({ name, source: path === null ? null : findSibling(side, source, path, name) }));
  const found = siblings.filter((sibling): sibling is { name: string; source: ContentSource } => sibling.source !== null);
  // One result for all the reads, a new one only when one of them changes.
  const reads = useQueries({
    // A file that isn't there is an answer (null), kept as any other; a failure is read again.
    queries: found.map(({ source: sibling }) => contentBytesQuery(place, sibling)),
    combine: combineReads,
  });
  const names = found.map(({ name }) => name).join('\n');
  const read = useMemo(() => {
    if (needed.length === 0) return NONE;
    if (reads.loading) return null;
    const listed = names.split('\n');
    return Object.fromEntries(reads.bytes.flatMap((bytes, i) => (bytes ? [[listed[i]!, bytes]] : [])));
  }, [needed, names, reads]);
  // The companions as first read while their bytes stay the same: a pending `.bin` read again comes as a new array.
  const kept = useRef(read);
  if (read && kept.current && read !== kept.current && sameCompanions(read, kept.current)) return kept.current;
  kept.current = read;
  return read;
}

function sameCompanions(a: Readonly<Record<string, Uint8Array>>, b: Readonly<Record<string, Uint8Array>>): boolean {
  const names = Object.keys(a);
  return names.length === Object.keys(b).length && names.every((name) => b[name] !== undefined && sameBytes(a[name]!, b[name]!));
}
