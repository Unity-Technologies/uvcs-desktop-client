import { repositorySpec } from '@shared/domain/specs';
import type { WorkspaceGlance } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { parsePendingChanges } from './pendingChangesXml';
import { parseWorkspaceStatus, serverByName } from './workspaceStatus';

/**
 * Reads another workspace's selector and pending changes with one `cm status --xml <path>`: a local read of the
 * workspace on disk, run from the home folder's `cm shell` so each workspace doesn't start sessions of its own. Its
 * server by name (`serverByName`, from the home folder too).
 */
export async function readWorkspaceGlance(cm: CmClient, workspacePath: string): Promise<WorkspaceGlance> {
  const { repositoryName, server, selector, pendingCount } = parseWorkspaceGlance(await cm.query(['status', '--xml', workspacePath]));
  return { repository: repositorySpec(repositoryName, await serverByName(cm, workspacePath, server)), selector, pendingCount };
}

/** The glance as `cm status --xml` prints it: a Unity organization's server by its id (`serverByName`). */
export function parseWorkspaceGlance(xml: string): Omit<WorkspaceGlance, 'repository'> & { repositoryName: string; server: string } {
  const { repositoryName, server, selector } = parseWorkspaceStatus(xml);
  return { repositoryName, server, selector, pendingCount: parsePendingChanges(xml).changes.length };
}
