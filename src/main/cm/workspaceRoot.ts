import type { CmClient } from './CmClient';

/**
 * The root of the workspace holding a folder or file, as `cm` names it; null outside any workspace. The path is
 * absolute, so the answer is the same from any directory (`anyDirectory`).
 */
export async function findWorkspaceRoot(cm: CmClient, path: string): Promise<string | null> {
  try {
    const output = await cm.query(['getworkspacefrompath', path, '--format={wkpath}'], { anyDirectory: true });
    return output.trim() || null;
  } catch {
    return null;
  }
}
