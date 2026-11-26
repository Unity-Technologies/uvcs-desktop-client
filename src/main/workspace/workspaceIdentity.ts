import { parseWorkspaceGuid, type WorkspaceGuid } from '@shared/domain/stableIds';
import type { WorkspaceKind, WorkspaceSelector } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { cmHeaderReaders, type HeaderReaders } from './WorkspaceHeaders';

export interface WorkspaceIdentity {
  guid: string;
  /** `name@server`. */
  repository: string;
  repositoryName: string;
  selector: WorkspaceSelector;
  /** Undefined when `cm` couldn't tell. */
  kind?: WorkspaceKind;
}

/** Which workspace this is and what it is loaded from; `headers` may answer from a read just made (`WorkspaceHeaders`). */
export async function readWorkspaceIdentity(from: CmClient | HeaderReaders, workspacePath: string): Promise<WorkspaceIdentity> {
  const headers = 'query' in from ? cmHeaderReaders(from) : from;
  const [status, { guid, kind }] = await Promise.all([headers.status(workspacePath), headers.names(workspacePath)]);
  return {
    guid,
    repository: `${status.repositoryName}@${status.server}`,
    repositoryName: status.repositoryName,
    selector: status.selector,
    ...(kind ? { kind } : {}),
  };
}

/**
 * The workspace's GUID, which a rename or a move keeps: from its names, which the workspace info shares
 * (`WorkspaceHeaders`), a local read. Undefined when `cm` printed none.
 */
export async function readWorkspaceGuid(headers: HeaderReaders, workspacePath: string): Promise<WorkspaceGuid | undefined> {
  return parseWorkspaceGuid((await headers.names(workspacePath)).guid);
}
