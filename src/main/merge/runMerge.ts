import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  baseVersionSpec,
  sourceVersionSpec,
  type FileConflictResolution,
  type MergePlan,
  type MergeRequest,
  type MergeResolutions,
  type MergeResult,
} from '@shared/domain/merge';
import { catArgs, catBatchesOf, explainCatFailure, type CatRead } from '../cm/catBatches';
import type { CmClient } from '../cm/CmClient';
import { createdChangesetOf, destinationMovedIn, mergeOutcomeRecordOf } from '../cm/mergeOutput';
import { readMergeProgress } from '../cm/progress/mergeProgress';
import { withTempDirectory } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { fileConflictResolutionsFile } from './fileConflictResolutionsFile';
import { fileConflictArgs, MACHINE_READABLE_ARGS, mergeSourceArgs } from './mergeArgs';
import { assertResolutionsComplete, describeUnmergeablePlan } from './mergeRules';
import { copyMergeState, mergeStateArgs, mergeStateFilesIn, type MergeStateFiles } from './mergeStateFiles';
import { previewMerge } from './previewMerge';

/**
 * Runs a merge with the user's decisions:
 * 1. The directory conflicts were decided on the page as they came, each applied by `cm` to its state files
 *    (`DirectoryDecisions`): `decided` holds them, and the merge goes on from a copy of it.
 * 2. The final `cm merge --merge` applies everything. Every conflicting file has a decision (see `fileConflictArgs`),
 *    so nothing is decided behind the user's back and no external merge tool opens. A merge into a server branch
 *    takes each file's decision from a resolutions file (`fileConflictResolutionsFile`).
 * 3. For workspace merges, each conflicting file is then written with its resolution: the text decided, the source's
 *    or base's text as the page read it, or else (binaries) that revision, all with one `cm cat`. A version that can't
 *    be saved leaves its file as yours, named in the result (`keptVersionNotSaved`, or `keptVersionMaybeNotSaved` when `cm`
 *    didn't tell): the merge is in the workspace by then.
 * It previews the merge again on those decisions first, and stops before changing the workspace when a conflict has
 * no decision.
 */
export async function runMerge(
  cm: CmClient,
  workspacePath: string,
  request: MergeRequest,
  resolutions: MergeResolutions,
  context: OperationContext,
  decided?: MergeStateFiles,
): Promise<MergeResult> {
  return withTempDirectory(async (directory) => {
    const state = mergeStateFilesIn(directory);
    if (decided) await copyMergeState(decided, state);
    const plan = await previewMerge(cm, workspacePath, request, decided && { state });
    const unmergeable = describeUnmergeablePlan(plan);
    if (unmergeable) throw new Error(unmergeable);
    assertResolutionsComplete(plan, resolutions);

    const commentsFile = join(directory, 'comment.txt');
    const fileConflictResolutionsPath = join(directory, 'file-conflict-resolutions.json');
    if (request.destinationBranch) {
      await writeFile(commentsFile, resolutions.comment ?? '', 'utf8');
      await writeServerFileConflictResolutions(cm, workspacePath, plan, resolutions.files, directory, fileConflictResolutionsPath, context.signal);
    }

    const mergeArgs = [
      'merge',
      ...mergeSourceArgs(request),
      '--merge',
      ...fileConflictArgs(request, plan, fileConflictResolutionsPath),
      '--nointeractiveresolution',
      ...MACHINE_READABLE_ARGS,
      ...mergeStateArgs(state),
      ...(request.destinationBranch ? [`--commentsfile=${commentsFile}`] : []),
    ];
    const outcome: string[][] = [];
    const progress = context.progressOf(readMergeProgress);
    // The merge's progress is read from its lines as they arrive, and the records that tell how it ended are kept.
    const onOutputLine = (line: string): void => {
      progress(line);
      const record = mergeOutcomeRecordOf(line);
      if (record) outcome.push(record);
    };
    await cm.execute(mergeArgs, { cwd: workspacePath, signal: context.signal, onOutputLine });

    if (request.destinationBranch) {
      return { changesetId: createdChangesetOf(outcome), ...(destinationMovedIn(outcome) && { destinationMoved: true }) };
    }

    context.reportProgress('Writing resolved files');
    const { notSaved, maybeNotSaved } = await writeFileConflictResolutions(cm, workspacePath, request, plan, resolutions.files);
    return { ...(notSaved.length > 0 && { keptVersionNotSaved: notSaved }), ...(maybeNotSaved.length > 0 && { keptVersionMaybeNotSaved: maybeNotSaved }) };
  });
}

/**
 * Writes the files `cm merge --to` reads each file conflict's decision from: the merged texts, and the bases kept that
 * the page holds no text of, saved by `cm cat` (one per batch, in a process: binaries run to hundreds of MB). Before
 * `cm merge` runs, so a base that can't be read stops the merge with nothing merged.
 */
async function writeServerFileConflictResolutions(
  cm: CmClient,
  workspacePath: string,
  plan: MergePlan,
  resolutions: Record<string, FileConflictResolution>,
  directory: string,
  fileConflictResolutionsPath: string,
  signal: AbortSignal,
): Promise<void> {
  const { json, resultFiles } = fileConflictResolutionsFile(plan, resolutions, directory);
  const revisions: KeptVersionRead[] = [];
  for (const resultFile of resultFiles) {
    if ('text' in resultFile) await writeFile(resultFile.file, resultFile.text, 'utf8');
    else revisions.push({ ...resultFile.revision, target: resultFile.file, size: -1 });
  }
  for (const batch of catBatchesOf(revisions, (read) => read)) {
    await cm.execute(catArgs(batch), { cwd: workspacePath, signal }).catch((error: unknown) => {
      const files = batch.map((read) => basename(read.path)).join(', ');
      throw new Error(`Couldn't read the base of ${files} to keep it, so nothing was merged. ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  await writeFile(fileConflictResolutionsPath, json, 'utf8');
}

/**
 * Writes each file's decision: a text as it is, and the incoming versions or bases kept the page holds no text of
 * (binaries, text in another encoding) saved by `cm` straight into the workspace, all of them with one `cm cat` per batch
 * (`catBatchesOf`), in a process even for one: binaries run to hundreds of MB, and a pooled session held that long
 * stalls every read behind it. `cm merge` has run by then: the writes take no cancel signal, as stopping them would
 * leave the merge half applied. `--file=` refuses a read-only file where `<spec>;<file>` doesn't check: these files are
 * checked out by the merge, so writable, either way. Returns the files whose kept version couldn't be saved.
 */
async function writeFileConflictResolutions(
  cm: CmClient,
  workspacePath: string,
  request: MergeRequest,
  plan: MergePlan,
  resolutions: Record<string, FileConflictResolution>,
): Promise<UnsavedVersions> {
  const keptVersionReads: KeptVersionRead[] = [];
  for (const conflict of plan.fileConflicts) {
    const resolution = resolutions[conflict.path]!;
    const target = toAbsolutePath(workspacePath, conflict.path.replace(/^\//, ''));

    const text = textToWrite(resolution);
    if (text !== undefined) {
      await retryWhileBusy(() => writeFile(target, text, 'utf8'));
    } else if (resolution.choice === 'source' || resolution.choice === 'base') {
      const kept = resolution.choice === 'source' ? sourceVersionSpec(request, conflict) : baseVersionSpec(conflict);
      keptVersionReads.push({ path: conflict.path, spec: kept, repository: conflict.repository, target, size: -1 });
    }
  }
  return saveKeptVersions(cm, workspacePath, keptVersionReads);
}

/** A version kept (incoming, or the base) for `cm cat` to save over a conflicting file, with the file's path in the plan. */
type KeptVersionRead = CatRead & { path: string };

/** The files whose kept version a merge couldn't save: those known to still hold yours, and those that may. */
interface UnsavedVersions {
  notSaved: string[];
  maybeNotSaved: string[];
}

/**
 * Saves the versions kept, every batch even when one fails: the merge is in the workspace already, so a failure
 * only names the files left holding yours. A revision `cm cat` names as not written (not found, or purged:
 * `explainCatFailure`) wasn't saved; a failure some line of
 * which names nothing (a download that failed, a dropped connection) is tried once more for the others, as saving a
 * version again changes nothing, and what fails again may not hold the version kept. A file another program
 * holds open on Windows fails too, with no retry: `cm` writes it, not `retryWhileBusy`.
 */
async function saveKeptVersions(cm: CmClient, workspacePath: string, reads: KeptVersionRead[]): Promise<UnsavedVersions> {
  const unsaved: UnsavedVersions = { notSaved: [], maybeNotSaved: [] };
  for (const batch of catBatchesOf(reads, (read) => read)) {
    let uncertain = await saveOnce(cm, workspacePath, batch, unsaved);
    if (uncertain.length > 0) uncertain = await saveOnce(cm, workspacePath, uncertain, unsaved);
    unsaved.maybeNotSaved.push(...uncertain.map((read) => read.path));
  }
  return unsaved;
}

/**
 * One `cm cat` of the reads: those it named as not written join `unsaved`; returns those it may not have written, when
 * some line of its failure names nothing.
 */
async function saveOnce(cm: CmClient, workspacePath: string, reads: KeptVersionRead[], unsaved: UnsavedVersions): Promise<KeptVersionRead[]> {
  const failure = await cm.execute(catArgs(reads), { cwd: workspacePath }).then(
    () => null,
    (error: unknown) => error,
  );
  if (failure === null) return [];
  const { unwritten, everyLineExplained } = explainCatFailure(reads, failure);
  const missing = unwritten.map(({ read }) => read);
  unsaved.notSaved.push(...missing.map((read) => read.path));
  return everyLineExplained ? [] : reads.filter((read) => !missing.includes(read));
}

/** The text a file is written with: the one decided, or the source's as read; none to keep the destination, or for `cm cat`. */
function textToWrite(resolution: FileConflictResolution): string | undefined {
  return resolution.choice === 'destination' ? undefined : resolution.text;
}
