import type { WorkspaceSummary } from '@shared/domain/workspace';

/**
 * The workspace the home screen offers to go back to: the one this window left, while `cm` lists it (the list the
 * home screen reads anyway). One whose folder is gone, or deleted meanwhile, is no way back.
 */
export function workspaceToReturnTo(leftPath: string | null, workspaces: WorkspaceSummary[] | undefined): WorkspaceSummary | null {
  return workspaces?.find((workspace) => workspace.path === leftPath) ?? null;
}
