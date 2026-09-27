import { lstat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ItemMove } from '@shared/domain/explorer';
import type { OperationContext } from '../operations/OperationTracker';
import { toAbsolutePath } from './workspacePaths';

interface ItemMover {
  /** Runs a `cm` command in the workspace. */
  cm: (args: string[]) => Promise<unknown>;
  renamePrivate: (fromPath: string, toPath: string) => Promise<void>;
  exists?: (path: string) => Promise<boolean>;
}

/** `cm move` of one controlled item to its new path: `cm` moves one item a command. */
export function moveArgs(workspacePath: string, move: Pick<ItemMove, 'from' | 'to'>, platform: NodeJS.Platform = process.platform): string[] {
  return ['move', toAbsolutePath(workspacePath, move.from, platform), toAbsolutePath(workspacePath, move.to, platform)];
}

/**
 * Moves items one after the other: controlled ones with `cm move` (a local change until checked in), private ones
 * renamed on disk. Never replaces an existing item: `cm move` onto a folder would move the item inside it. Stops at
 * the first failure, and between items once stopped.
 */
export async function moveItems(
  workspacePath: string,
  moves: readonly ItemMove[],
  { cm, renamePrivate, exists = pathExists }: ItemMover,
  context: Pick<OperationContext, 'signal' | 'reportProgress'>,
): Promise<void> {
  for (const [index, move] of moves.entries()) {
    if (context.signal.aborted) throw new Error('Stopped');
    context.reportProgress('Moving items', { current: index, total: moves.length });
    const toPath = toAbsolutePath(workspacePath, move.to);
    if (await exists(toPath)) throw new Error(`${basename(toPath)} already exists.`);
    if (move.isPrivate) await renamePrivate(toAbsolutePath(workspacePath, move.from), toPath);
    else await cm(moveArgs(workspacePath, move));
  }
  context.reportProgress('Moving items', { current: moves.length, total: moves.length });
}

async function pathExists(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    () => false,
  );
}
