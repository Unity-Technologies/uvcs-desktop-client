import { open as openFile, readdir as readFolder } from 'node:fs/promises';
import { workspaceFileOf } from '../files/workspacePaths';
import type { ProjectFiles } from './ProjectAssetIndex';

/** The calls of `node:fs/promises` the disk is read with; tests pass failing ones. */
interface FolderAndFileReads {
  readdir: (path: string, options: { withFileTypes: true }) => Promise<{ name: string; isDirectory(): boolean }[]>;
  open: (path: string, flags: 'r') => Promise<{ read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number }>; close(): Promise<void> }>;
}

/** Reads at once, across every index: macOS lets a process keep 256 files open by default, and the app has others. */
const AT_ONCE = 32;

/**
 * A workspace's files as `ProjectAssetIndex` reads them, never outside the workspace (`workspaceFileOf`). What isn't
 * there (`ENOENT`, `ENOTDIR`) is none; any other failure (a `.meta` Unity or an antivirus holds, too many files open)
 * rejects, so the index keeps nothing of it.
 */
export function diskProjectFiles(workspacePath: string, fs: FolderAndFileReads = { readdir: readFolder, open: openFile }): ProjectFiles {
  return {
    list: (folder) =>
      limited(async () => {
        const entries = await fs.readdir(workspaceFileOf(workspacePath, folder), { withFileTypes: true }).catch(absent(() => []));
        return entries.map((entry) => ({ name: entry.name, isFolder: entry.isDirectory() }));
      }),
    head: (path, length) =>
      limited(async () => {
        const file = await fs.open(workspaceFileOf(workspacePath, path), 'r').catch(absent(() => null));
        if (!file) return null;
        try {
          const buffer = Buffer.alloc(length);
          const { bytesRead } = await file.read(buffer, 0, length, 0);
          return buffer.toString('utf8', 0, bytesRead);
        } finally {
          await file.close();
        }
      }),
  };
}

/** A failure that says the thing isn't there turns into `none`; any other is thrown on. */
function absent<T>(none: () => T): (error: NodeJS.ErrnoException) => T {
  return (error) => {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return none();
    throw error;
  };
}

let running = 0;
const waiting: (() => void)[] = [];

/** Runs `read` when fewer than `AT_ONCE` reads run; the slot passes straight to the next waiting, never left free. */
async function limited<T>(read: () => Promise<T>): Promise<T> {
  if (running < AT_ONCE) running++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await read();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}
