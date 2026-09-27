import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { IMMUTABLE_QUERY, queryClient } from '../../../app/queryClient';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { isImmutableContent } from './immutableContent';

/** Going back to a diff within the hour shows it at once, without keeping every file ever opened in memory. */
const REVISION_CACHE_MS = 60 * 60_000;
/**
 * How long another pair has to stay shown before versions not read yet are read: holding ↓ through a list of files
 * (a key repeat every 30 to 90 ms) reads none of the files it passes, each one or two `cm cat`s.
 */
const SETTLE_MS = 150;

export interface DiffContents {
  original: ContentSource;
  modified: ContentSource;
  left: FileContent;
  right: FileContent;
}

/**
 * Both versions of a file, loaded as one pair so they always arrive together. While another
 * file loads, the previous pair stays as placeholder data: fast navigation swaps diffs
 * instead of flashing a spinner. A pair already read shows at once; one not read yet once the
 * selection stops on it for a moment.
 */
export function useDiffContents(workspacePath: string, original: ContentSource, modified: ContentSource) {
  const queryKey = queryKeys.inWorkspace(workspacePath, 'diffContents', original, modified);
  const pair = JSON.stringify(queryKey);
  const settled = useDebouncedValue(pair, SETTLE_MS) === pair;
  return useQuery({
    queryKey,
    enabled: settled || queryClient.getQueryData(queryKey) !== undefined,
    queryFn: async (): Promise<DiffContents> => {
      const [left, right] = await Promise.all([readContent(workspacePath, original), readContent(workspacePath, modified)]);
      return { original, modified, left, right };
    },
    ...contentCaching([original, modified]),
    placeholderData: keepPreviousData,
  });
}

/** Each side keeps its own cache entry, shared with other views of the same version. */
function readContent(workspacePath: string, source: ContentSource): Promise<FileContent> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
    queryFn: () => api.content.read(workspacePath, source),
    ...contentCaching([source]),
  });
}

/**
 * Live contents are read again whenever asked. A revision (by id, or a spec pinned to a changeset or shelve) never
 * changes: read once, kept an hour after its last use, skipped by refreshes. Others (the loaded revision) stay until
 * an operation refreshes the workspace.
 */
function contentCaching(sources: ContentSource[]) {
  if (sources.some(isLive)) return { staleTime: 0 };
  if (sources.every(isImmutableContent)) return { staleTime: Infinity, gcTime: REVISION_CACHE_MS, meta: IMMUTABLE_QUERY };
  return { staleTime: Infinity };
}

/** Workspace files change under us, and so does the reviewed copy on every new review; revisions never do. */
function isLive(source: ContentSource): boolean {
  return source.kind === 'workspaceFile' || source.kind === 'reviewSnapshot';
}
