import type { MergePlan, MergeRequest } from '@shared/domain/merge';
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
 * How `cm merge --merge` treats conflicting files. Every conflict gets an explicit decision, because a file left to
 * `cm` would be merged by its external merge tool, and this app never opens one. Workspace merges keep the
 * destination and the app writes the resolutions afterwards. A merge into a server branch hands `cm` each file's
 * decision in `resolutionsFile` (`fileResolutionsFile`).
 */
export function fileConflictArgs(request: MergeRequest, plan: MergePlan, resolutionsFile: string): string[] {
  if (plan.fileConflicts.length === 0) return [];
  return request.destinationBranch ? [`--resolutionsfile=${resolutionsFile}`] : ['--keepdestination'];
}
