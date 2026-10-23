// The queries of a version's content and of a file's bytes beside a model (a `.meta`, a `.mtl`, a `.bin`), and how
// any content is cached (`contentCaching`). Built here, never inline in a hook or component: TanStack keeps a query's
// options, its query function with them, for as long as the query is cached (an hour for a revision), and a function
// made inside a hook keeps that hook's whole scope alive. The model diff's hooks hold both versions' bytes and parsed
// models: a heap snapshot found 107 MB kept that way after the viewer was gone.

import type { Place } from '@shared/domain/place';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../../app/queryClient';
import { isImmutableContent } from './immutableContent';

export function contentQuery(place: Place, source: ContentSource) {
  return {
    queryKey: queryKeys.inPlace(place, 'content', source),
    queryFn: (): Promise<FileContent> => api.content.read(place, source),
    ...contentCaching([source]),
  };
}

/** A file's bytes; null where it isn't there, an answer kept as any other (a failure is read again). */
export function contentBytesQuery(place: Place, source: ContentSource) {
  return {
    queryKey: queryKeys.inPlace(place, 'contentBytes', source),
    queryFn: (): Promise<Uint8Array | null> => api.content.readBytes(place, source),
    ...contentCaching([source]),
  };
}

/** Going back to a diff within the hour shows it at once, without keeping every file ever opened in memory. */
const REVISION_CACHE_MS = 60 * 60_000;

/**
 * Live contents are read again whenever asked. A revision (by id, or a spec pinned to a changeset or shelve) never
 * changes: read once, kept an hour after its last use, skipped by refreshes. Others (the loaded revision) stay until
 * an operation refreshes the workspace.
 */
export function contentCaching(sources: ContentSource[]) {
  if (sources.some(isLive)) return { staleTime: 0 };
  if (sources.every(isImmutableContent)) return { staleTime: Infinity, gcTime: REVISION_CACHE_MS, meta: IMMUTABLE_QUERY };
  return { staleTime: Infinity };
}

/** Workspace files change under us, and so does the reviewed copy on every new review; revisions never do. */
function isLive(source: ContentSource): boolean {
  return source.kind === 'workspaceFile' || source.kind === 'reviewSnapshot';
}
