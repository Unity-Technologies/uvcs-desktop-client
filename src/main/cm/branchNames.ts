import type { CmClient } from './CmClient';
import { parseRecords, recordFormat } from './formatRecords';

export interface BranchName {
  id: number;
  name: string;
}

const ID_AND_NAME = recordFormat(['id', 'name']);

/**
 * The object id and name of every branch, hidden ones included (`cm find branch` leaves them out unless asked): two
 * light queries, instead of ids ORed together a few dozen at a time (`cm find` has no `in (...)`).
 */
export async function readBranchNames(cm: CmClient, workspacePath: string): Promise<BranchName[]> {
  const read = (conditions: string[]) => cm.query(['find', 'branch', ...conditions, `--format=${ID_AND_NAME}`, '--nototal'], { cwd: workspacePath });
  const [visible, hidden] = await Promise.all([read([]), read(["where hidden = 'true'"])]);
  return [...parseBranchNames(visible), ...parseBranchNames(hidden)];
}

export function parseBranchNames(output: string): BranchName[] {
  return parseRecords(output).map(([id = '', name = '']) => ({ id: Number(id), name }));
}
