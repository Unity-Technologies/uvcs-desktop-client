import type { WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { readWorkspaceStatus } from '../cm/workspaceStatus';

export interface WorkspaceIdentity {
  guid: string;
  /** `name@server`. */
  repository: string;
  repositoryName: string;
  selector: WorkspaceSelector;
  loadedChangeset: number;
}

/** Which workspace this is and what it is loaded from. */
export async function readWorkspaceIdentity(cm: CmClient, workspacePath: string): Promise<WorkspaceIdentity> {
  const [status, guid] = await Promise.all([
    readWorkspaceStatus(cm, workspacePath),
    cm.query(['getworkspacefrompath', workspacePath, '--format={guid}']),
  ]);
  return {
    guid: guid.trim(),
    repository: `${status.repositoryName}@${status.server}`,
    repositoryName: status.repositoryName,
    selector: status.selector,
    loadedChangeset: status.loadedChangeset,
  };
}
