import { readdir, stat } from 'node:fs/promises';
import type { NewFolderCheck } from '@shared/domain/workspace';

/** A new workspace goes in a folder that doesn't exist yet (`cm` creates it) or an empty one. */
export async function checkNewWorkspaceFolder(path: string): Promise<NewFolderCheck> {
  const found = await stat(path).catch(() => null);
  if (!found) return 'available';
  if (!found.isDirectory()) return 'notAFolder';
  return (await readdir(path)).length === 0 ? 'available' : 'notEmpty';
}
