import type { WorkspaceGlance } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { parsePendingChanges } from './pendingChangesXml';
import { parseWorkspaceStatus } from './workspaceStatus';

/**
 * Reads another workspace's selector and pending changes with one `cm status --xml <path>`: a local read of the
 * workspace on disk, which answers the same from any directory (`anyDirectory`). So each workspace glanced at starts
 * no sessions of its own, and the switcher of a workspace window none in the home folder.
 */
export async function readWorkspaceGlance(cm: CmClient, workspacePath: string): Promise<WorkspaceGlance> {
  return parseWorkspaceGlance(await cm.query(['status', '--xml', workspacePath], { anyDirectory: true }));
}

export function parseWorkspaceGlance(xml: string): WorkspaceGlance {
  return { selector: parseWorkspaceStatus(xml).selector, pendingCount: parsePendingChanges(xml).changes.length };
}
