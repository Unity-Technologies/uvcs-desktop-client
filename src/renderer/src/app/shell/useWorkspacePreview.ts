import { queryClient } from '../queryClient';
import { workspacePreviewFromCache, type WorkspacePreview } from './workspacePreview';

/**
 * What the home screen already read of the workspace at `path`, from the cache only: it never asks `cm`. The top bar
 * shows it while the workspace's own info loads, so the pills change as little as possible when it arrives. Read at
 * render, not watched: the pills render again when the info's query changes, and the preview only matters until then.
 */
export function useWorkspacePreview(path: string): WorkspacePreview {
  return workspacePreviewFromCache(queryClient, path);
}
