import type { CmClient } from '../cm/CmClient';
import { equalsCondition } from '../cm/findQuery';
import { recordFormat, type ReadRecord } from '../cm/formatRecords';

/**
 * The changeset that merged `sourceChangeset` into `destinationBranch`, or null when it was never merged there. One
 * merge link at most (`limit 1`), so it stays cheap on repositories with many merges.
 */
export async function findMergedInto(cm: CmClient, workspacePath: string, sourceChangeset: number, destinationBranch: string): Promise<number | null> {
  const [changeset = null] = await cm.queryRecords(mergedIntoArgs(sourceChangeset, destinationBranch), destinationChangeset, { cwd: workspacePath });
  return changeset;
}

export function mergedIntoArgs(sourceChangeset: number, destinationBranch: string): string[] {
  return [
    'find',
    'merge',
    `where srcchangeset = ${sourceChangeset} and ${equalsCondition('dstbranch', destinationBranch)} limit 1`,
    `--format=${recordFormat(['dstchangeset'])}`,
    '--nototal',
  ];
}

const destinationChangeset: ReadRecord<number> = ([field]) => {
  const changeset = Number(field);
  return Number.isInteger(changeset) ? changeset : undefined;
};
