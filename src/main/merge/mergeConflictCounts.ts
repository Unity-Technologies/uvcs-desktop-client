import type { MergeConflictCounts } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { readFields } from '../cm/formatRecords';
import { mergePlanOf } from '../cm/mergeOutput';
import { mergePlanArgs } from './mergeArgs';

/**
 * How many files and directory conflicts merging `source` into `destination` on the server would leave, from the
 * merge page's own preview (`mergePlanArgs`, without `--merge`: nothing changes). It runs in a process of its own
 * (`executeRecords`), unlike the merge page's (`readMergePlan`, a pooled `cm shell`): the card's check runs in the
 * background of a page someone is reading, and for the second or so it takes on a big repository it would hold one of
 * the workspace's two pooled sessions the page's own reads (its conversation, its changes) go through. On the merge
 * page the preview is what the user waits for, and a process would only add its start-up.
 */
export async function countMergeConflicts(cm: CmClient, workspacePath: string, source: string, destination: string): Promise<MergeConflictCounts> {
  const args = mergePlanArgs({ kind: 'merge', sourceSpec: spec.branch(source), destinationBranch: destination });
  const records = await cm.executeRecords(args, readFields, { cwd: workspacePath });
  // `cm` always names the merge's contributors, even with nothing to merge: no record at all is no answer.
  if (records.length === 0) throw new Error(`cm merge printed no plan for merging ${source} into ${destination}`);
  const plan = mergePlanOf(records);
  return { status: plan.status, files: plan.fileConflicts.length, directories: plan.directoryConflicts.length };
}
