import type { MergeRequest } from '@shared/domain/merge';
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
