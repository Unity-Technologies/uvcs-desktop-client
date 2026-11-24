import type { Place } from '@shared/domain/place';
import type { CmClient } from './CmClient';
import { cmPlace } from './cmPlace';
import { queryOn } from './findQuery';
import { recordFormat, type ReadRecord } from './formatRecords';

export interface BranchName {
  id: number;
  name: string;
}

/** How the names of branches are asked of the server (`BranchNamesCache`). */
export interface BranchNameReads {
  /** Every branch's id and name, hidden ones too (`readBranchNames`). */
  every(place: Place): Promise<BranchName[]>;
  /** One branch's, by its id; none for a branch deleted since (`readBranchName`). */
  one(place: Place, id: number): Promise<BranchName | undefined>;
}

/** Branch names asked of the server through `cm`. */
export function cmBranchNameReads(cm: CmClient): BranchNameReads {
  return { every: (place) => readBranchNames(cm, place), one: (place, id) => readBranchName(cm, place, id) };
}

const ID_AND_NAME = recordFormat(['id', 'name']);

const branchName: ReadRecord<BranchName> = ([id = '', name = '']) => ({ id: Number(id), name });

/**
 * The object id and name of every branch, hidden ones included (`cm find branch` leaves them out unless asked): two
 * light queries, instead of ids ORed together a few dozen at a time (`cm find` has no `in (...)`).
 */
export async function readBranchNames(cm: CmClient, place: Place): Promise<BranchName[]> {
  const [visible, hidden] = await Promise.all([findBranchNames(cm, place, ''), findBranchNames(cm, place, "where hidden = 'true'")]);
  return [...visible, ...hidden];
}

/**
 * One branch's id and name, by its id; none for a branch deleted since. A hidden branch is asked for only when the
 * visible ones don't hold it, as `cm find branch` leaves hidden ones out unless asked.
 */
export async function readBranchName(cm: CmClient, place: Place, id: number): Promise<BranchName | undefined> {
  const [visible] = await findBranchNames(cm, place, `where id = ${id}`);
  if (visible) return visible;
  const [hidden] = await findBranchNames(cm, place, `where id = ${id} and hidden = 'true'`);
  return hidden;
}

function findBranchNames(cm: CmClient, place: Place, query: string): Promise<BranchName[]> {
  const at = cmPlace(place);
  return cm.queryRecords(['find', 'branch', queryOn(query, at.repository), `--format=${ID_AND_NAME}`, '--nototal'].filter(Boolean), branchName, at.options);
}
