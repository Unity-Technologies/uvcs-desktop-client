import { open, readdir } from 'node:fs/promises';
import { workspaceFileOf } from '../files/workspacePaths';
import type { ProjectFiles } from './ProjectAssetIndex';

/** A workspace's files as `ProjectAssetIndex` reads them, never outside the workspace (`workspaceFileOf`). */
export function diskProjectFiles(workspacePath: string): ProjectFiles {
  return {
    async list(folder) {
      const entries = await readdir(workspaceFileOf(workspacePath, folder), { withFileTypes: true }).catch(() => []);
      return entries.map((entry) => ({ name: entry.name, isFolder: entry.isDirectory() }));
    },
    async head(path, length) {
      const file = await open(workspaceFileOf(workspacePath, path), 'r').catch(() => null);
      if (!file) return null;
      try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await file.read(buffer, 0, length, 0);
        return buffer.toString('utf8', 0, bytesRead);
      } catch {
        return null;
      } finally {
        await file.close();
      }
    },
  };
}
