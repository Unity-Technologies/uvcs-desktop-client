import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The two files `cm merge` keeps a merge's directory decisions in (`--mergeresultfile`, `--solvedconflictsfile`): a run
 * given them goes on from those decisions instead of calculating the merge again, and a `--resolveconflict` run adds
 * its decision to them (`DirectoryDecisions`). `cm` writes both on the first decision.
 */
export interface MergeStateFiles {
  result: string;
  solved: string;
}

/** The state files in `folder`, which `cm` creates on its first decision there. */
export function mergeStateFilesIn(folder: string): MergeStateFiles {
  return { result: join(folder, 'result'), solved: join(folder, 'solved') };
}

export function mergeStateArgs({ result, solved }: MergeStateFiles): string[] {
  return [`--mergeresultfile=${result}`, `--solvedconflictsfile=${solved}`];
}

/** Copies the decisions `from` holds to `to`, for a run to go on from them without changing them. */
export async function copyMergeState(from: MergeStateFiles, to: MergeStateFiles): Promise<void> {
  await copyFile(from.result, to.result);
  await copyFile(from.solved, to.solved);
}
