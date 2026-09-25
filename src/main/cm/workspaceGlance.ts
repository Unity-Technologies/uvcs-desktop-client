import type { WorkspaceGlance } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { parsePendingChanges } from './pendingChangesXml';
import { parseWorkspaceStatus } from './workspaceStatus';

/**
 * Reads another workspace's selector and pending changes with one `cm status --xml <path>`: a local read of the
 * workspace on disk, run from the home folder's `cm shell` so each workspace doesn't start sessions of its own.
 */
export async function readWorkspaceGlance(cm: CmClient, workspacePath: string): Promise<WorkspaceGlance> {
  return parseWorkspaceGlance(await cm.query(['status', '--xml', workspacePath]));
}

export function parseWorkspaceGlance(xml: string): WorkspaceGlance {
  const { repositoryName, server, selector } = parseWorkspaceStatus(xml);
  return { repository: `${repositoryName}@${server}`, selector, pendingCount: parsePendingChanges(xml).changes.length };
}
