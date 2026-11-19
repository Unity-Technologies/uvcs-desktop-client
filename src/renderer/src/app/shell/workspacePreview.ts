import type { WorkspaceHead, WorkspaceInfo, WorkspaceSelector, WorkspaceSummary } from '@shared/domain/workspace';

/** What the top bar can show of a workspace before its own info is read: what the home screen already read of it. */
export interface WorkspacePreview {
  name?: string;
  /** `name@server`, or the repository's own name when `cm` names its server only by an id. */
  repository?: string;
  selector?: WorkspaceSelector;
}

/**
 * The workspace at `path` as the workspace list (`workspaceListQuery`) and the home screen's heads
 * (`workspaceHeadsQuery`, any of them) told it: empty when the window opened straight into it, before either was read.
 */
export function workspacePreview(
  path: string,
  workspaces: readonly WorkspaceSummary[] | undefined,
  headRecords: readonly (Record<string, WorkspaceHead> | undefined)[],
): WorkspacePreview {
  const head = headRecords.map((heads) => heads?.[path]).find((found) => found !== undefined);
  return {
    name: workspaces?.find((workspace) => workspace.path === path)?.name,
    repository: head ? (head.repository ?? head.repositoryName) : undefined,
    selector: head?.selector ?? undefined,
  };
}

/** What the top bar shows of the workspace: its own info once read, else its preview. Unknown parts show as placeholders. */
export function shownWorkspace(info: Pick<WorkspaceInfo, 'name' | 'repository' | 'selector'> | undefined, preview: WorkspacePreview): WorkspacePreview {
  return info ? { name: info.name, repository: info.repository, selector: info.selector } : preview;
}
