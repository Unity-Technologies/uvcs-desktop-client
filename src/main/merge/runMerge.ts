import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  mergeSourcePoint,
  type DirectoryConflictResolution,
  type FileConflictResolution,
  type MergePlan,
  type MergeRequest,
  type MergeResolutions,
  type MergeResult,
} from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { catArgs, catBatchesOf, explainCatFailure, type CatRead } from '../cm/catBatches';
import type { CmClient } from '../cm/CmClient';
import { parseCreatedChangeset, parseDestinationMoved, parseMergePlan } from '../cm/mergeOutput';
import { directoryConflictIdentity } from './directoryConflictIdentity';
import { readMergeProgress } from '../cm/progress/mergeProgress';
import { withTempDirectory } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { fileConflictResolutionsFile } from './fileConflictResolutionsFile';
import { fileConflictArgs, MACHINE_READABLE_ARGS, mergeSourceArgs } from './mergeArgs';
import { assertResolutionsComplete, describeUnmergeablePlan } from './mergeRules';
import { previewMerge } from './previewMerge';

/**
 * Runs a merge with the user's decisions:
 * 1. Directory conflicts are solved one by one with `--resolveconflict`; `cm` keeps the decisions in state files.
 * 2. The final `cm merge --merge` applies everything. Every conflicting file has a decision (see `fileConflictArgs`),
 *    so nothing is decided behind the user's back and no external merge tool opens. A merge into a server branch
 *    takes each file's decision from a resolutions file (`fileConflictResolutionsFile`).
 * 3. For workspace merges, each conflicting file is then written with its resolution: the text decided, the source's
 *    text as the page read it, or else (binaries) the source's revision, all with one `cm cat`. A version that can't
 *    be saved leaves its file as yours, named in the result (`incomingNotSaved`, or `incomingMaybeNotSaved` when `cm`
 *    didn't tell): the merge is in the workspace by then.
 * If anything looks different from the plan the user reviewed, it stops before changing the workspace.
 */
export async function runMerge(
  cm: CmClient,
  workspacePath: string,
  request: MergeRequest,
  resolutions: MergeResolutions,
  context: OperationContext,
): Promise<MergeResult> {
  const plan = await previewMerge(cm, workspacePath, request);
  const unmergeable = describeUnmergeablePlan(plan);
  if (unmergeable) throw new Error(unmergeable);
  assertResolutionsComplete(plan, resolutions);

  return withTempDirectory(async (directory) => {
    const commentsFile = join(directory, 'comment.txt');
    const fileConflictResolutionsPath = join(directory, 'file-conflict-resolutions.json');
    if (request.destinationBranch) {
      await writeFile(commentsFile, resolutions.comment ?? '', 'utf8');
      await writeServerFileConflictResolutions(plan, resolutions.files, directory, fileConflictResolutionsPath);
    }

    const mergeArgs = [
      'merge',
      ...mergeSourceArgs(request),
      '--merge',
      ...fileConflictArgs(request, plan, fileConflictResolutionsPath),
      '--nointeractiveresolution',
      ...MACHINE_READABLE_ARGS,
      `--mergeresultfile=${join(directory, 'result')}`,
      `--solvedconflictsfile=${join(directory, 'solved')}`,
      ...(request.destinationBranch ? [`--commentsfile=${commentsFile}`] : []),
    ];
    const run = (args: string[]): Promise<string> =>
      cm.execute(args, {
        cwd: workspacePath,
        signal: context.signal,
        onOutputLine: context.progressOf(readMergeProgress),
      });

    await resolveDirectoryConflicts(plan, resolutions.directoryConflicts, (resolution) => run([...mergeArgs, ...resolveConflictArgs(resolution)]));
    const output = await run(mergeArgs);

    if (request.destinationBranch) {
      return { changesetId: parseCreatedChangeset(output), ...(parseDestinationMoved(output) && { destinationMoved: true }) };
    }

    context.reportProgress('Writing resolved files');
    const { notSaved, maybeNotSaved } = await writeFileConflictResolutions(cm, workspacePath, request, plan, resolutions.files);
    return { ...(notSaved.length > 0 && { incomingNotSaved: notSaved }), ...(maybeNotSaved.length > 0 && { incomingMaybeNotSaved: maybeNotSaved }) };
  });
}

async function writeServerFileConflictResolutions(
  plan: MergePlan,
  resolutions: Record<string, FileConflictResolution>,
  directory: string,
  fileConflictResolutionsPath: string,
): Promise<void> {
  const { json, resultFiles } = fileConflictResolutionsFile(plan, resolutions, directory);
  for (const { file, text } of resultFiles) await writeFile(file, text, 'utf8');
  await writeFile(fileConflictResolutionsPath, json, 'utf8');
}

/** `cm` numbers the remaining conflicts on each run, so the next one to solve is always number 1. */
async function resolveDirectoryConflicts(
  plan: MergePlan,
  resolutions: DirectoryConflictResolution[],
  solveNext: (resolution: DirectoryConflictResolution) => Promise<string>,
): Promise<void> {
  for (const [index, resolution] of resolutions.entries()) {
    const output = await solveNext(resolution);
    const remaining = parseMergePlan(output).directoryConflicts.map(directoryConflictIdentity);
    const expected = plan.directoryConflicts.slice(index + 1).map(directoryConflictIdentity);
    if (remaining.join('\n') !== expected.join('\n')) {
      throw new Error('The merge changed while solving its directory conflicts, so nothing was merged. Review it again.');
    }
  }
}

function resolveConflictArgs(resolution: DirectoryConflictResolution): string[] {
  const common = ['--resolveconflict', '--conflict=1'];
  switch (resolution.choice) {
    case 'source':
      return [...common, '--resolutionoption=src'];
    case 'destination':
      return [...common, '--resolutionoption=dst'];
    case 'rename':
      return [...common, '--resolutionoption=rename', `--resolutioninfo=${resolution.newName}`];
  }
}

/**
 * Writes each file's decision: a text as it is, and the incoming versions the page holds no text of (binaries, text in
 * another encoding) saved by `cm` straight into the workspace, all of them with one `cm cat` per batch
 * (`catBatchesOf`), in a process even for one: binaries run to hundreds of MB, and a pooled session held that long
 * stalls every read behind it. `cm merge` has run by then: the writes take no cancel signal, as stopping them would
 * leave the merge half applied. `--file=` refuses a read-only file where `<spec>;<file>` doesn't check: these files are
 * checked out by the merge, so writable, either way. Returns the files whose incoming version couldn't be saved.
 */
async function writeFileConflictResolutions(
  cm: CmClient,
  workspacePath: string,
  request: MergeRequest,
  plan: MergePlan,
  resolutions: Record<string, FileConflictResolution>,
): Promise<UnsavedIncoming> {
  const incomingReads: IncomingRead[] = [];
  for (const conflict of plan.fileConflicts) {
    const resolution = resolutions[conflict.path]!;
    const target = toAbsolutePath(workspacePath, conflict.path.replace(/^\//, ''));

    const text = textToWrite(resolution);
    if (text !== undefined) {
      await retryWhileBusy(() => writeFile(target, text, 'utf8'));
    } else if (resolution.choice === 'source') {
      const source = spec.itemAt(conflict.itemId, mergeSourcePoint(request, conflict.sourceChangeset), conflict.repository);
      incomingReads.push({ path: conflict.path, spec: source, repository: conflict.repository, target, size: -1 });
    }
  }
  return saveIncomingVersions(cm, workspacePath, incomingReads);
}

/** An incoming version for `cm cat` to save over a conflicting file, with the file's path in the plan. */
type IncomingRead = CatRead & { path: string };

/** The files whose incoming version a merge couldn't save: those known to still hold yours, and those that may. */
interface UnsavedIncoming {
  notSaved: string[];
  maybeNotSaved: string[];
}

/**
 * Saves the incoming versions, every batch even when one fails: the merge is in the workspace already, so a failure
 * only names the files left holding yours. A revision `cm cat` names as not found wasn't saved; a failure some line of
 * which names nothing (a download that failed, a dropped connection) is tried once more for the others, as saving a
 * version again changes nothing, and what fails again may not hold the incoming version. A file another program
 * holds open on Windows fails too, with no retry: `cm` writes it, not `retryWhileBusy`.
 */
async function saveIncomingVersions(cm: CmClient, workspacePath: string, reads: IncomingRead[]): Promise<UnsavedIncoming> {
  const unsaved: UnsavedIncoming = { notSaved: [], maybeNotSaved: [] };
  for (const batch of catBatchesOf(reads, (read) => read)) {
    let uncertain = await saveOnce(cm, workspacePath, batch, unsaved);
    if (uncertain.length > 0) uncertain = await saveOnce(cm, workspacePath, uncertain, unsaved);
    unsaved.maybeNotSaved.push(...uncertain.map((read) => read.path));
  }
  return unsaved;
}

/**
 * One `cm cat` of the reads: those it named as not found join `unsaved`; returns those it may not have written, when
 * some line of its failure names nothing.
 */
async function saveOnce(cm: CmClient, workspacePath: string, reads: IncomingRead[], unsaved: UnsavedIncoming): Promise<IncomingRead[]> {
  const failure = await cm.execute(catArgs(reads), { cwd: workspacePath }).then(
    () => null,
    (error: unknown) => error,
  );
  if (failure === null) return [];
  const { notFound, everyLineExplained } = explainCatFailure(reads, failure);
  const missing = notFound.map(({ read }) => read);
  unsaved.notSaved.push(...missing.map((read) => read.path));
  return everyLineExplained ? [] : reads.filter((read) => !missing.includes(read));
}

/** The text a file is written with: the one decided, or the source's as read; none to keep the destination, or for `cm cat`. */
function textToWrite(resolution: FileConflictResolution): string | undefined {
  return resolution.choice === 'destination' ? undefined : resolution.text;
}
