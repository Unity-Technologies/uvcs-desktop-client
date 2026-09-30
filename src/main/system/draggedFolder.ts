import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DraggedFolder } from '@shared/api/system';

/**
 * What a dragged path is: a folder that is a workspace (it or a folder above it holds `.plastic`), another folder, or
 * nothing to open (null: a file, or gone). Only the disk is read, never `cm`, as it runs on every drag.
 */
export async function describeDraggedFolder(path: string | null): Promise<DraggedFolder | null> {
  if (!path || !(await isDirectory(path))) return null;
  return { path, isWorkspace: await isInsideWorkspace(path) };
}

async function isInsideWorkspace(folder: string): Promise<boolean> {
  for (let current = folder; ; current = dirname(current)) {
    if (await isDirectory(join(current, '.plastic'))) return true;
    if (dirname(current) === current) return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null))?.isDirectory() ?? false;
}
