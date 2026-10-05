import { useQueries } from '@tanstack/react-query';
import { useContext, useMemo } from 'react';
import type { ContentSource, ModelBytes } from '@shared/domain/content';
import { api } from '../../../../api/client';
import { queryKeys } from '../../../../api/queryKeys';
import { contentCaching } from '../useDiffContents';
import { gltfCompanions } from './gltfJson';
import { SiblingFinderContext, sourcePathOf, type DiffSide } from './modelSiblings';

const NONE: Readonly<Record<string, Uint8Array>> = {};

/** The reads as one, made again only when one of them changes: a function of its own, as TanStack reruns a new one each render. */
function combineReads(results: { isPending: boolean; data?: Uint8Array | null }[]): { loading: boolean; bytes: (Uint8Array | null)[] } {
  return { loading: results.some((result) => result.isPending), bytes: results.map((result) => result.data ?? null) };
}

/**
 * The files a version of a model needs beside it (a glTF's `.bin`), read as the version of each that goes with it
 * (`SiblingFinderContext`), cached as any content is; null while they are being read. A file that can't be found or
 * read is left out: the model then says it needs it. A self-contained model needs none, and reads at once.
 */
export function useModelCompanions(workspacePath: string, side: DiffSide, source: ContentSource, model: ModelBytes | undefined): Readonly<Record<string, Uint8Array>> | null {
  const findSibling = useContext(SiblingFinderContext);
  const path = sourcePathOf(source);
  const needed = useMemo(() => (model ? gltfCompanions(model.bytes, model.format) : []), [model]);
  const siblings = needed.map((name) => ({ name, source: path === null ? null : findSibling(side, source, path, name) }));
  const found = siblings.filter((sibling): sibling is { name: string; source: ContentSource } => sibling.source !== null);
  // One result for all the reads, a new one only when one of them changes.
  const reads = useQueries({
    queries: found.map(({ source: sibling }) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'contentBytes', sibling),
      // A file that isn't there is an answer, kept as any other: read again on each view, it would cost a `cm cat` each time.
      queryFn: () => api.content.readBytes(workspacePath, sibling).catch(() => null),
      ...contentCaching([sibling]),
    })),
    combine: combineReads,
  });
  const names = found.map(({ name }) => name).join('\n');
  return useMemo(() => {
    if (needed.length === 0) return NONE;
    if (reads.loading) return null;
    const listed = names.split('\n');
    return Object.fromEntries(reads.bytes.flatMap((bytes, i) => (bytes ? [[listed[i]!, bytes]] : [])));
  }, [needed, names, reads]);
}
