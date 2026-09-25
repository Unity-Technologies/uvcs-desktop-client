import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';

export interface DiffContents {
  original: ContentSource;
  modified: ContentSource;
  left: FileContent;
  right: FileContent;
}

/**
 * Both versions of a file, loaded as one pair so they always arrive together. While another
 * file loads, the previous pair stays as placeholder data: fast navigation swaps diffs
 * instead of flashing a spinner.
 */
export function useDiffContents(workspacePath: string, original: ContentSource, modified: ContentSource) {
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'diffContents', original, modified),
    queryFn: async (): Promise<DiffContents> => {
      const [left, right] = await Promise.all([readContent(workspacePath, original), readContent(workspacePath, modified)]);
      return { original, modified, left, right };
    },
    staleTime: isLive(original) || isLive(modified) ? 0 : Infinity,
    placeholderData: keepPreviousData,
  });
}

/** Each side keeps its own cache entry, shared with other views of the same version. */
function readContent(workspacePath: string, source: ContentSource): Promise<FileContent> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
    queryFn: () => api.content.read(workspacePath, source),
    staleTime: isLive(source) ? 0 : Infinity,
  });
}

/** Workspace files change under us, and so does the reviewed copy on every new review; revisions never do. */
function isLive(source: ContentSource): boolean {
  return source.kind === 'workspaceFile' || source.kind === 'reviewSnapshot';
}
