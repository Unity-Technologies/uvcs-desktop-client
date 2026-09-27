import { mkdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { DiffEntry } from '@shared/domain/diff';
import type { MergeRequest } from '@shared/domain/merge';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { spec } from '@shared/domain/specs';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { automaticShelveComment, parseCreatedShelves, type CreatedShelve } from '../cm/automaticShelve';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readShelveProgress } from '../cm/progress/shelveProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { waitForNextSecond } from '../files/nextSecond';
import { withTempFile } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import type { OperationContext } from '../operations/OperationTracker';
import { missingFromShelve, newItemPaths } from './pendingSnapshot';
import { moveAside } from './privateBackups';
import type { SwitchShelveRecords } from './switchShelveRecords';

const XLINK_CHANGES = "Changes inside Xlinks can't be shelved yet. Check them in first.";

/**
 * Shelves the pending changes with the official automatic-shelve comment (every change, or just the given paths),
 * and checks that the shelve really holds them all before anything is undone. Otherwise the shelves are deleted and it fails.
 */
export function createSwitchShelve(
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

/**
 * Added files stay on disk as private files after the undo: they would show up as new files, and on a switch's target
 * (renamed `.private.0` where the target has the same path). They are moved into the app's data folder until the
 * shelve brings them back (`putBack`), and the record says where.
 */
export async function moveNewItemsAside(
  cm: CmClient,
  records: SwitchShelveRecords,
  workspacePath: string,
  changes: PendingChange[],
  record: SwitchShelveRecord,
  backupsRoot: string,
): Promise<void> {
  const privatePaths = new Set(parsePendingChanges(await cm.query(['status', '--xml', '--private'], { cwd: workspacePath })).changes.map((change) => change.path));
  const paths = newItemPaths(changes).filter((path) => privatePaths.has(path));
  if (paths.length === 0) return;

  const directory = join(backupsRoot, `${record.createdAt.replace(/[:.]/g, '-')}-sh${record.shelveId}`);
  record.backup = { directory, paths };
  records.save(record);
  await moveAside(workspacePath, paths, directory);
}

/** The items a shelve changes. */
export async function readShelveEntries(cm: CmClient, workspacePath: string, shelveId: number): Promise<DiffEntry[]> {
  const output = await cm.query(['diff', spec.shelve(shelveId), '--repositorypaths', `--format=${DIFF_FORMAT}`], { cwd: workspacePath });
  return parseDiffEntries(output);
}

export async function deleteShelves(cm: CmClient, workspacePath: string, shelves: CreatedShelve[]): Promise<void> {
  for (const shelve of shelves) await cm.query(['shelveset', 'delete', `sh:${shelve.id}@${shelve.repository}`], { cwd: workspacePath });
}

/** `applied` counts the changes merged: none when the workspace already had them. */
export type ApplyOutcome = { kind: 'applied'; count: number } | { kind: 'conflicts'; count: number } | { kind: 'pendingChanges' };

/**
 * Applies a shelve as a merge from it (never `cm shelveset apply`, which opens the merge tool on conflicts),
 * only when nothing conflicts. Conflicts are left for the merge view.
 */
export async function applyShelveCleanly(cm: CmClient, workspacePath: string, shelveId: number, context: OperationContext): Promise<ApplyOutcome> {
  const request: MergeRequest = { kind: 'merge', sourceSpec: spec.shelve(shelveId) };
  const plan = await previewMerge(cm, workspacePath, request);
  if (plan.status === 'pendingChanges') return { kind: 'pendingChanges' };
  if (plan.status !== 'ready') return { kind: 'applied', count: 0 };

  const conflictCount = plan.fileConflicts.length + plan.directoryConflicts.length;
  if (conflictCount > 0) return { kind: 'conflicts', count: conflictCount };

  await runMerge(cm, workspacePath, request, { directoryConflicts: [], files: {} }, context);
  return { kind: 'applied', count: plan.changes.length };
}

/**
 * A merge from a shelve loads the shelve's revisions of the files it brings, which are gone once the shelve is
 * deleted: reading the file's base (its diff) would then fail. Kept, each file diffs against the shelve's revision and
 * shows no change at all. It "replaces" the files the workspace has, and "copies" back the ones the destination deleted
 * (a change kept over a deletion). Once that merge is done, replaced files become plain checkouts with the same content
 * (links with the same target), and copied ones plain added files. Only right after that merge: every replaced or
 * copied file comes from it.
 */
export async function detachReplacedFiles(cm: CmClient, workspacePath: string): Promise<void> {
  const { changes } = parsePendingChanges(await cm.query(['status', '--xml', '--controlledchanged'], { cwd: workspacePath }));
  const items = changes
    .filter((change) => (change.kinds.includes('replaced') || change.kinds.includes('copied')) && !change.kinds.includes('moved') && change.itemType !== 'directory')
    .map((change) => ({ path: toAbsolutePath(workspacePath, change.path), link: change.itemType === 'symlink', copied: !change.kinds.includes('replaced') }));
  if (items.length === 0) return;

  // A link's content is where it points: reading or writing the file would go through to its target.
  const contents = await Promise.all(items.map((item) => (item.link ? readlink(item.path) : readFile(item.path))));
  // Undoing a copied file takes it off the disk; a replaced one gets the loaded revision back.
  await cm.query(onLinksThemselves('undo', ...items.map((item) => item.path)), { cwd: workspacePath });
  // In a later second than the undo wrote them: rewritten with as many bytes within that second, they'd look unchanged.
  await waitForNextSecond();
  await Promise.all(items.map((item, index) => (item.link ? relink(item.path, contents[index] as string) : rewrite(item.path, contents[index] as Buffer))));
  const replaced = items.filter((item) => !item.copied).map((item) => item.path);
  const copied = items.filter((item) => item.copied).map((item) => item.path);
  if (replaced.length > 0) await cm.query(onLinksThemselves('checkout', ...replaced), { cwd: workspacePath });
  if (copied.length > 0) await cm.query(['add', ...copied], { cwd: workspacePath });
}

async function rewrite(path: string, content: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function relink(path: string, target: string): Promise<void> {
  await rm(path, { force: true });
  await mkdir(dirname(path), { recursive: true });
  await symlink(target, path);
}
