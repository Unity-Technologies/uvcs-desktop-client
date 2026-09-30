import type { CmClient } from '../cm/CmClient';

/**
 * Whether the workspace has pending changes (private files aside): `cm merge` refuses to merge into such a workspace,
 * and a switch only ever runs without them. A local read.
 */
export async function hasPendingChanges(cm: CmClient, workspacePath: string): Promise<boolean> {
  const output = await cm.query(['status', '--short', '--controlledchanged', '--changed', '--localdeleted'], { cwd: workspacePath });
  return output.trim().length > 0;
}
