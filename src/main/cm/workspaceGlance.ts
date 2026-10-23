import type { WorkspaceGlance } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { PendingChangesReader, statusRecordsArgs } from './pendingChangesRecords';
import { resolvedRootOf } from './printedWorkspacePaths';
import { parseWorkspaceStatus } from './workspaceStatus';

/**
 * Reads another workspace's selector (`cm status --header --xml <path>`) and counts its pending changes
 * (`cm status <path>` as records, which a workspace of a million changes prints as one of ten does): two local reads
 * of the workspace on disk, which answer the same from any directory (`anyDirectory`). So each workspace glanced at
 * starts no sessions of its own, and the switcher of a workspace window none in the home folder. Records hold no
 * selector, and XML holding the changes was too large to read past about 400,000 of them.
 */
export async function readWorkspaceGlance(cm: CmClient, workspacePath: string, platform: NodeJS.Platform = process.platform): Promise<WorkspaceGlance> {
  const reader = new PendingChangesReader(workspacePath, { platform, resolvedRoot: await resolvedRootOf(workspacePath) });
  const [header, changes] = await Promise.all([
    cm.query(['status', '--header', '--xml', workspacePath], { anyDirectory: true }),
    // A count that fails (paths `cm` prints outside the root the app knows) leaves the branch to show.
    cm.queryRecords(statusRecordsArgs(workspacePath), reader.read, { anyDirectory: true }).catch(() => null),
  ]);
  return { selector: parseWorkspaceStatus(header).selector, pendingCount: changes?.length ?? null };
}
