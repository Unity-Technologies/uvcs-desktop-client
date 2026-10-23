import type { Place } from '@shared/domain/place';
import type { CmClient } from './CmClient';
import { cmPlace } from './cmPlace';
import { queryOn } from './findQuery';
import { recordFormat, type ReadRecord } from './formatRecords';

export interface BranchName {
  id: number;
  name: string;
}

const ID_AND_NAME = recordFormat(['id', 'name']);

const branchName: ReadRecord<BranchName> = ([id = '', name = '']) => ({ id: Number(id), name });

/**
 * The object id and name of every branch, hidden ones included (`cm find branch` leaves them out unless asked): two
 * light queries, instead of ids ORed together a few dozen at a time (`cm find` has no `in (...)`).
 */
export async function readBranchNames(cm: CmClient, place: Place): Promise<BranchName[]> {
  const at = cmPlace(place);
  const read = (query: string) =>
    cm.queryRecords(['find', 'branch', queryOn(query, at.repository), `--format=${ID_AND_NAME}`, '--nototal'].filter(Boolean), branchName, at.options);
  const [visible, hidden] = await Promise.all([read(''), read("where hidden = 'true'")]);
  return [...visible, ...hidden];
}
