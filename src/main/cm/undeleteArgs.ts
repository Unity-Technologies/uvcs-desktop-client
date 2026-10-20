import type { DeletedItemRestore } from '@shared/domain/explorer';
import { workspaceFileOf } from '../files/workspacePaths';

/**
 * `cm undelete` of one deleted item: its last revision written back at `restore.path` (a folder with everything it
 * held then) and recorded as copied, a pending change. `cm` takes one item a command.
 *
 * The revision goes by its bare id, against the rule that a revision always names its repository (`spec.revision`):
 * `cm undelete` refuses every spec that names one ("revid:18@game@local and /ws/a.cs must be on the same repository
 * to perform the operation", even when it is the workspace's), and looks the bare id up in the repository of the
 * restore path. So only an item of the workspace's own repository is restored, never one under an xlink.
 */
export function undeleteArgs(workspacePath: string, restore: DeletedItemRestore, platform: NodeJS.Platform = process.platform): string[] {
  return ['undelete', `revid:${restore.revision.revisionId}`, workspaceFileOf(workspacePath, restore.path, platform)];
}
