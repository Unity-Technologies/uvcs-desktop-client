import { join } from 'node:path';
import type { WorkspaceKind } from '@shared/domain/workspace';
import type { MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { CmError } from '../cm/CmError';
import { loadedItemsArgs, readLoadedItem, type LoadedItem } from '../cm/loadedItems';
import { hasPendingChanges } from '../merge/hasPendingChanges';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import type { OperationContext } from '../operations/OperationTracker';
import { countEntriesNeedingMerge, foldersShelveTouches } from './shelveAppliesWithoutMerge';
import { readShelveEntries } from './verifiedShelve';

/** `applied` counts the changes merged: none when the workspace already had them. */
export type ApplyOutcome = { kind: 'applied'; count: number } | { kind: 'conflicts'; count: number } | { kind: 'pendingChanges' };

/**
 * Applies a shelve only when nothing conflicts; otherwise it stays shelved, for the merge view. A standard or dynamic
 * workspace merges from it (never `cm shelveset apply`, which opens the merge tool on conflicts); a partial one, which
 * can't merge, applies it with `cm partial shelveset apply` once it is sure no merge is needed.
 */
export function applyShelveCleanly(cm: CmClient, workspacePath: string, shelveId: number, kind: WorkspaceKind, context: OperationContext): Promise<ApplyOutcome> {
  return kind === 'partial' ? applyToPartial(cm, workspacePath, shelveId) : mergeFromShelve(cm, workspacePath, shelveId, context);
}

async function mergeFromShelve(cm: CmClient, workspacePath: string, shelveId: number, context: OperationContext): Promise<ApplyOutcome> {
  const request: MergeRequest = { kind: 'merge', sourceSpec: spec.shelve(shelveId) };
  const plan = await previewMerge(cm, workspacePath, request);
  if (plan.status === 'pendingChanges') return { kind: 'pendingChanges' };
  if (plan.status !== 'ready') return { kind: 'applied', count: 0 };

  const conflictCount = plan.fileConflicts.length + plan.directoryConflicts.length;
  if (conflictCount > 0) return { kind: 'conflicts', count: conflictCount };

  await runMerge(cm, workspacePath, request, { files: {} }, context);
  return { kind: 'applied', count: plan.changes.length };
}

/**
 * `cm partial shelveset apply` has no preview and, on a conflict, waits for the merge tool: so it runs only on a
 * workspace with no changes (a file changed but not checked out keeps its revision in `cm ls`) whose loaded items are
 * what the shelve started from (`countEntriesNeedingMerge`).
 */
async function applyToPartial(cm: CmClient, workspacePath: string, shelveId: number): Promise<ApplyOutcome> {
  if (await hasPendingChanges(cm, workspacePath)) return { kind: 'pendingChanges' };

  const entries = await readShelveEntries(cm, workspacePath, shelveId);
  if (entries.length === 0) return { kind: 'applied', count: 0 };

  const loaded = await readLoadedItems(cm, workspacePath, foldersShelveTouches(entries));
  const needingMerge = loaded === undefined ? entries.length : countEntriesNeedingMerge(entries, loaded);
  if (needingMerge > 0) return { kind: 'conflicts', count: needingMerge };

  await cm.execute(['partial', 'shelveset', 'apply', spec.shelve(shelveId)], { cwd: workspacePath });
  return { kind: 'applied', count: entries.length };
}

/** What the workspace has loaded in `folders`; undefined when one isn't loaded, which `cm ls` fails on. */
async function readLoadedItems(cm: CmClient, workspacePath: string, folders: readonly string[]): Promise<LoadedItem[] | undefined> {
  try {
    return await cm.queryRecords(loadedItemsArgs(folders.map((folder) => join(workspacePath, folder))), readLoadedItem, { cwd: workspacePath });
  } catch (error) {
    if (!(error instanceof CmError)) throw error;
    return undefined;
  }
}
