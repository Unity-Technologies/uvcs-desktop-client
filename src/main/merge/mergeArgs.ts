import type { MergePlan, MergeRequest, MergeResolutions } from '@shared/domain/merge';
import { MERGE_FIELD_SEPARATOR } from '../cm/mergeOutput';

export const MACHINE_READABLE_ARGS = ['--machinereadable', `--fieldseparator=${MERGE_FIELD_SEPARATOR}`];

/** The source and kind of a merge, as `cm merge` arguments. */
export function mergeSourceArgs(request: MergeRequest): string[] {
  return [
    request.sourceSpec,
    ...(request.kind === 'cherryPick' ? ['--cherrypicking'] : []),
    ...(request.kind === 'subtractive' ? ['--subtractive'] : []),
    ...(request.intervalOriginSpec ? [`--interval-origin=${request.intervalOriginSpec}`] : []),
    ...(request.destinationBranch ? [`--to=br:${request.destinationBranch}`] : []),
  ];
}

/**
 * How `cm merge --merge` treats conflicting files. Every conflict gets an explicit decision, because a
 * file left to `cm` would be merged by its external merge tool, and this app never opens one.
 * Workspace merges keep the destination and the app writes the resolutions afterwards. A merge into a
 * server branch cannot take per-file content, so it keeps the same side for every conflicting file.
 */
export function fileConflictArgs(request: MergeRequest, plan: MergePlan, resolutions: MergeResolutions): string[] {
  if (plan.fileConflicts.length === 0) return [];
  if (!request.destinationBranch) return ['--keepdestination'];

  const choices = new Set(plan.fileConflicts.map((conflict) => resolutions.files[conflict.path]?.choice));
  if (choices.size === 1 && choices.has('source')) return ['--keepsource'];
  if (choices.size === 1 && choices.has('destination')) return ['--keepdestination'];
  throw new Error('A merge into a server branch must keep the same side for every conflicting file.');
}
