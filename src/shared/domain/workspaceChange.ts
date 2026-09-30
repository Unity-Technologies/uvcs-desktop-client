/** What changed on disk in a workspace since the last event. */
export interface WorkspaceChange {
  /** Workspace files changed: the pending changes may differ. */
  content: boolean;
  /** Items were added, deleted or moved, not only edited. */
  pathsChanged: boolean;
  /** `cm` rewrote the workspace state in `.plastic` (checkin, update, switch, undo...), whoever ran it. */
  metadata: boolean;
  /**
   * The folders whose items changed (workspace-relative, `/`-separated, `''` for the root); null when the platform
   * didn't tell, or too many changed to list them (`MAX_CHANGED_FOLDERS`): anywhere.
   */
  folders: string[] | null;
}

/** Past this many folders, a change counts as anywhere: the listings to re-read would be most of what's open anyway. */
export const MAX_CHANGED_FOLDERS = 100;

/** What two changes in a row changed, as one. */
export function mergeWorkspaceChanges(first: WorkspaceChange, second: WorkspaceChange): WorkspaceChange {
  return {
    content: first.content || second.content,
    pathsChanged: first.pathsChanged || second.pathsChanged,
    metadata: first.metadata || second.metadata,
    folders: mergeFolders(first.folders, second.folders),
  };
}

function mergeFolders(first: string[] | null, second: string[] | null): string[] | null {
  if (first === null || second === null) return null;
  const added = second.filter((folder) => !first.includes(folder));
  if (added.length === 0) return first;
  const merged = [...first, ...new Set(added)];
  return merged.length > MAX_CHANGED_FOLDERS ? null : merged;
}
