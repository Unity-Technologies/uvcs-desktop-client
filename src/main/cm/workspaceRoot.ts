import type { CmClient } from './CmClient';

/** The root of the workspace holding a folder or file, as `cm` names it; null outside any workspace. */
export async function findWorkspaceRoot(cm: CmClient, path: string): Promise<string | null> {
  try {
    const output = await cm.query(['getworkspacefrompath', path, '--format={wkpath}']);
    return output.trim() || null;
  } catch {
    return null;
  }
}
