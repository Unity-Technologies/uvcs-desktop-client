import type { ShelvedChangelist } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { toAbsolutePaths } from '../files/workspacePaths';

/** Puts changes back into the changelists they were in when shelved. Local commands, two per changelist. */
export async function restoreChangelists(cm: CmClient, workspacePath: string, changelists: ShelvedChangelist[]): Promise<void> {
  for (const changelist of changelists) {
    await cm.query(['changelist', 'create', changelist.name, changelist.description, '--persistent'], { cwd: workspacePath }).catch(() => {
      // It still exists: changelists outlive their changes.
    });
    const paths = toAbsolutePaths(workspacePath, changelist.paths);
    await cm.query(['changelist', changelist.name, 'add', ...paths], { cwd: workspacePath }).catch(() => {
      // Some paths may not be pending anymore (the user resolved them differently); the rest stay in the default changelist.
    });
  }
}
