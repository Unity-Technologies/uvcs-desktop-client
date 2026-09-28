import type { WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { cmHeaderReaders, type HeaderReaders } from './WorkspaceHeaders';

export interface WorkspaceIdentity {
  guid: string;
  /** `name@server`. */
  repository: string;
  repositoryName: string;
  selector: WorkspaceSelector;
}

/** Which workspace this is and what it is loaded from; `headers` may answer from a read just made (`WorkspaceHeaders`). */
export async function readWorkspaceIdentity(from: CmClient | HeaderReaders, workspacePath: string): Promise<WorkspaceIdentity> {
  const headers = 'query' in from ? cmHeaderReaders(from) : from;
  const [status, { guid }] = await Promise.all([headers.status(workspacePath), headers.names(workspacePath)]);
  return {
    guid,
    repository: `${status.repositoryName}@${status.server}`,
    repositoryName: status.repositoryName,
    selector: status.selector,
  };
}
