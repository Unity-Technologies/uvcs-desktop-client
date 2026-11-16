import type { MergeConflictCounts } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { readFields } from '../cm/formatRecords';
import { mergePlanOf } from '../cm/mergeOutput';
import { mergePlanArgs } from './mergeArgs';

/**
 * How many files and directory conflicts merging `source` into `destination` on the server would leave, from the
 * merge page's own preview (`mergePlanArgs`, without `--merge`: nothing changes). It takes over a second on a big
 * repository, so it runs in a process of its own (`executeRecords`): held that long, a pooled `cm shell` would stall
 * every read of the window behind it.
 */
export async function countMergeConflicts(cm: CmClient, workspacePath: string, source: string, destination: string): Promise<MergeConflictCounts> {
  const args = mergePlanArgs({ kind: 'merge', sourceSpec: spec.branch(source), destinationBranch: destination });
  const plan = mergePlanOf(await cm.executeRecords(args, readFields, { cwd: workspacePath }));
  return { status: plan.status, files: plan.fileConflicts.length, directories: plan.directoryConflicts.length };
}
