import type { ContentSource, FileContent } from '@shared/domain/content';
import { workspaceKey } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { refreshQueries } from '../../../app/refresh/refreshQueries';
import { isAffectedByFileChanges } from '../../../app/refresh/refreshScopes';
import type { DiffContents } from './useDiffContents';

/** Puts the text in the cached contents of the file and in the diffs showing it, so they update without waiting for the disk. */
export function showFileText(workspacePath: string, path: string, text: string): void {
  const isFile = (source: ContentSource | undefined): boolean => source?.kind === 'workspaceFile' && source.path === path;
  const withText = (content: FileContent): FileContent => ({ ...content, text, size: new TextEncoder().encode(text).length });
  for (const query of queryClient.getQueryCache().findAll({ queryKey: workspaceKey(workspacePath) })) {
    const [, , area, first, second] = query.queryKey as [string, string, string, ContentSource?, ContentSource?];
    if (area === 'content' && isFile(first)) {
      queryClient.setQueryData<FileContent>(query.queryKey, (content) => content && withText(content));
    } else if (area === 'diffContents' && (isFile(first) || isFile(second))) {
      queryClient.setQueryData<DiffContents>(query.queryKey, (contents) =>
        contents && { ...contents, left: isFile(first) ? withText(contents.left) : contents.left, right: isFile(second) ? withText(contents.right) : contents.right },
      );
    }
  }
}

/** Re-reads what depends on the workspace's files (also with auto refresh off). */
export function refreshFileViews(workspacePath: string): Promise<void> {
  return refreshQueries({ queryKey: workspaceKey(workspacePath), predicate: ({ queryKey }) => isAffectedByFileChanges(queryKey) });
}
