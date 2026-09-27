import { readFile, writeFile } from 'node:fs/promises';
import type { DiffEntry } from '@shared/domain/diff';
import type { MergeRequest } from '@shared/domain/merge';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { spec } from '@shared/domain/specs';
import { automaticShelveComment, parseCreatedShelves, type CreatedShelve } from '../cm/automaticShelve';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readShelveProgress } from '../cm/progress/shelveProgress';
import { waitForNextSecond } from '../files/nextSecond';
import { withTempFile } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import type { OperationContext } from '../operations/OperationTracker';
import { missingFromShelve } from './pendingSnapshot';

const XLINK_CHANGES = "Changes inside Xlinks can't be shelved yet. Check them in first.";

/**
 * Shelves the pending changes with the official automatic-shelve comment (every change, or just the given paths),
 * and checks that the shelve really holds them all before anything is undone. Otherwise the shelves are deleted and it fails.
 */
export async function createSwitchShelve(
  cm: CmClient,
  workspacePath: string,
  changes: PendingChange[],
  objectRef: string,
  context: OperationContext,
  onlyPaths?: string[],
): Promise<CreatedShelve> {
  const targets = onlyPaths?.map((path) => toAbsolutePath(workspacePath, path)) ?? [];
  const output = await withTempFile(automaticShelveComment(objectRef), (commentsFile) =>
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

export type ApplyOutcome = { kind: 'applied' } | { kind: 'conflicts'; count: number } | { kind: 'pendingChanges' };

/**
 * Applies a shelve as a merge from it (never `cm shelveset apply`, which opens the merge tool on conflicts),
 * only when nothing conflicts. Conflicts are left for the merge view.
 */
export async function applyShelveCleanly(cm: CmClient, workspacePath: string, shelveId: number, context: OperationContext): Promise<ApplyOutcome> {
  const request: MergeRequest = { kind: 'merge', sourceSpec: spec.shelve(shelveId) };
  const plan = await previewMerge(cm, workspacePath, request);
  if (plan.status === 'pendingChanges') return { kind: 'pendingChanges' };
  if (plan.status !== 'ready') return { kind: 'applied' };

  const conflictCount = plan.fileConflicts.length + plan.directoryConflicts.length;
  if (conflictCount > 0) return { kind: 'conflicts', count: conflictCount };

  await runMerge(cm, workspacePath, request, { directoryConflicts: [], files: {} }, context);
  return { kind: 'applied' };
}

/**
 * A merge from a shelve "replaces" the files it brings with the shelve's revisions, which are gone once the shelve
 * is deleted: reading the file's base (its diff) would then fail. Before deleting a shelve whose merge is done, those
 * files become plain checkouts with the same content. Only right after that merge: every replaced file comes from it.
 */
export async function detachReplacedFiles(cm: CmClient, workspacePath: string): Promise<void> {
  const { changes } = parsePendingChanges(await cm.query(['status', '--xml', '--controlledchanged'], { cwd: workspacePath }));
  const paths = changes
    .filter((change) => change.kinds.includes('replaced') && !change.kinds.includes('moved') && change.itemType !== 'directory')
    .map((change) => toAbsolutePath(workspacePath, change.path));
  if (paths.length === 0) return;

  const contents = await Promise.all(paths.map((path) => readFile(path)));
  await cm.query(['undo', ...paths], { cwd: workspacePath });
  // In a later second than the undo wrote them: rewritten with as many bytes within that second, they'd look unchanged.
  await waitForNextSecond();
  await Promise.all(paths.map((path, index) => writeFile(path, contents[index]!)));
  await cm.query(['checkout', ...paths], { cwd: workspacePath });
}
