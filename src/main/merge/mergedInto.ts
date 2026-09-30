import type { CmClient } from '../cm/CmClient';
import { equalsCondition } from '../cm/findQuery';
import { parseRecords, recordFormat } from '../cm/formatRecords';

/**
 * The changeset that merged `sourceChangeset` into `destinationBranch`, or null when it was never merged there. One
 * merge link at most (`limit 1`), so it stays cheap on repositories with many merges.
 */
export async function findMergedInto(cm: CmClient, workspacePath: string, sourceChangeset: number, destinationBranch: string): Promise<number | null> {
  const output = await cm.query(mergedIntoArgs(sourceChangeset, destinationBranch), { cwd: workspacePath });
  return parseMergedInto(output);
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

export function parseMergedInto(output: string): number | null {
  const [record] = parseRecords(output);
  const changeset = Number(record?.[0]);
  return record && Number.isInteger(changeset) ? changeset : null;
}
