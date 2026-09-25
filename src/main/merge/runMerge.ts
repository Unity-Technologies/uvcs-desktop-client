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
import type { CmClient } from '../cm/CmClient';
import { describeMergeProgress, directoryConflictIdentity, parseCreatedChangeset, parseMergePlan } from '../cm/mergeOutput';
import { withTempDirectory } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { MACHINE_READABLE_ARGS, mergeSourceArgs } from './mergeArgs';
import { assertResolutionsComplete, describeUnmergeablePlan } from './mergeRules';
import { previewMerge } from './previewMerge';

/**
 * Runs a merge with the user's decisions:
 * 1. Directory conflicts are solved one by one with `--resolveconflict`; `cm` keeps the decisions in state files.
 * 2. The final `cm merge --merge` applies everything. Conflicting files keep the destination content,
 *    so nothing is decided behind the user's back.
 * 3. For workspace merges, each conflicting file is then written with its resolution.
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
    if (request.destinationBranch) await writeFile(commentsFile, resolutions.comment ?? '', 'utf8');

    const mergeArgs = [
      'merge',
      ...mergeSourceArgs(request),
      '--merge',
      ...fileConflictArgs(request, plan, resolutions),
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
        onOutputLine: (line) => {
          const progress = describeMergeProgress(line);
          if (progress) context.reportProgress(progress);
        },
      });

    await resolveDirectoryConflicts(plan, resolutions.directoryConflicts, (resolution) => run([...mergeArgs, ...resolveConflictArgs(resolution)]));
    const output = await run(mergeArgs);

    if (request.destinationBranch) return { changesetId: parseCreatedChangeset(output) };

    context.reportProgress('Writing resolved files');
    await writeFileResolutions(cm, workspacePath, request, plan, resolutions.files);
    return {};
  });
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
 * Workspace merges keep the destination and write the resolutions afterwards. A merge into a server branch
 * cannot take per-file content: it either keeps one side for every conflicting file or lets `cm` merge them.
 */
function fileConflictArgs(request: MergeRequest, plan: MergePlan, resolutions: MergeResolutions): string[] {
  if (plan.fileConflicts.length === 0) return [];
  if (!request.destinationBranch) return ['--keepdestination'];

  const choices = new Set(plan.fileConflicts.map((conflict) => resolutions.files[conflict.path]!.choice));
  if (choices.size > 1) throw new Error('A merge into a server branch must resolve every conflicting file the same way.');
  const [choice] = choices;
  if (choice === 'source') return ['--keepsource'];
  if (choice === 'destination') return ['--keepdestination'];
  return [];
}

async function writeFileResolutions(
  cm: CmClient,
  workspacePath: string,
  request: MergeRequest,
  plan: MergePlan,
  resolutions: Record<string, FileConflictResolution>,
): Promise<void> {
  for (const conflict of plan.fileConflicts) {
    const resolution = resolutions[conflict.path]!;
    const target = toAbsolutePath(workspacePath, conflict.path.replace(/^\//, ''));

    if (resolution.choice === 'text') {
      await writeFile(target, resolution.text, 'utf8');
    } else if (resolution.choice === 'source') {
      const source = spec.itemAt(conflict.itemId, mergeSourcePoint(request, conflict.sourceChangeset));
      await cm.query(['cat', source, `--file=${target}`], { cwd: workspacePath });
    }
  }
}
