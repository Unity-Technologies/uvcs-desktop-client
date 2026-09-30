import type { DiffEntry } from '@shared/domain/diff';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { spec } from '@shared/domain/specs';
import { automaticShelveComment, parseCreatedShelves, type CreatedShelve } from '../cm/automaticShelve';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { readShelveProgress } from '../cm/progress/shelveProgress';
import { withTempFile } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { missingFromShelve } from './pendingSnapshot';

const XLINK_CHANGES = "Changes inside Xlinks can't be shelved yet. Check them in first.";

/**
 * `createVerifiedShelve` with the official automatic-shelve comment, naming where the changes were made (`objectRef`):
 * "Welcome back" and the official client find such shelves as changes left there.
 */
export function createAutomaticShelve(
  cm: CmClient,
  workspacePath: string,
  changes: PendingChange[],
  objectRef: string,
  context: OperationContext,
  onlyPaths?: string[],
): Promise<CreatedShelve> {
  return createVerifiedShelve(cm, workspacePath, changes, automaticShelveComment(objectRef), context, onlyPaths);
}

/**
 * Shelves the pending changes with `comment` (every change, or just the given paths), and checks that the shelve really
 * holds them all before anything is undone. Otherwise the shelves are deleted and it fails.
 */
export async function createVerifiedShelve(
  cm: CmClient,
  workspacePath: string,
  changes: PendingChange[],
  comment: string,
  context: OperationContext,
  onlyPaths?: string[],
): Promise<CreatedShelve> {
  const targets = onlyPaths?.map((path) => toAbsolutePath(workspacePath, path)) ?? [];
  const output = await withTempFile(comment, (commentsFile) =>
    cm.execute(['shelveset', 'create', ...targets, '--all', `-commentsfile=${commentsFile}`], {
      cwd: workspacePath,
      onOutputLine: context.progressOf(readShelveProgress),
    }),
  );
  const created = parseCreatedShelves(output);
  if (created.length === 0) throw new Error('The shelve finished but no shelve was reported, so the workspace was left as it was.');
  if (created.length > 1) {
    await deleteShelves(cm, workspacePath, created);
    throw new Error(XLINK_CHANGES);
  }

  const [shelve] = created as [CreatedShelve];
  const entries = await readShelveEntries(cm, workspacePath, shelve.id);
  const missing = missingFromShelve(changes, new Set(entries.flatMap((entry) => (entry.oldPath ? [entry.path, entry.oldPath] : [entry.path]))));
  if (missing.length > 0) {
    await deleteShelves(cm, workspacePath, created);
    throw new Error(`Some changes couldn't be shelved (${missing.slice(0, 3).join(', ')}), so the workspace was left as it was. Check them in first.`);
  }
  return shelve;
}

/** The items a shelve changes. */
export async function readShelveEntries(cm: CmClient, workspacePath: string, shelveId: number): Promise<DiffEntry[]> {
  const output = await cm.query(['diff', spec.shelve(shelveId), '--repositorypaths', `--format=${DIFF_FORMAT}`], { cwd: workspacePath });
  return parseDiffEntries(output);
}

export async function deleteShelves(cm: CmClient, workspacePath: string, shelves: CreatedShelve[]): Promise<void> {
  for (const shelve of shelves) await cm.query(['shelveset', 'delete', `sh:${shelve.id}@${shelve.repository}`], { cwd: workspacePath });
}
