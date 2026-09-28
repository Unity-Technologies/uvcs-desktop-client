import type { MergeLinkType } from '@shared/domain/branchExplorer';
import type { PendingMergeLink } from '@shared/domain/pendingChanges';

/** `cm` names only three kinds of merge in a change's merge info; an interval also names where it starts. */
const TYPES: Record<string, { plain: MergeLinkType; interval: MergeLinkType }> = {
  Merge: { plain: 'merge', interval: 'interval' },
  Cherrypick: { plain: 'cherryPick', interval: 'intervalCherryPick' },
  Subtractive: { plain: 'subtractive', interval: 'intervalSubtractive' },
};

/**
 * The merges a change of `cm status` comes from, read from its merge info: `Merge from 58, Cherrypick from 3 to 7`
 * (the kind words are `cm`'s own; "from", "to" and "on" are localized, so only the numbers are read). An interval names
 * where it starts, then its source. Merges of an xlinked repository (`... on rep:<spec>`) are that repository's.
 */
export function mergeLinksOf(mergeInfo: string): PendingMergeLink[] {
  return mergeInfo.split(', ').flatMap((entry): PendingMergeLink[] => {
    const match = /^\s*\(?\s*(Merge|Cherrypick|Subtractive) (.*?)\)?\s*$/.exec(entry);
    if (!match || match[2]!.includes('rep:')) return [];
    const numbers = [...match[2]!.matchAll(/\d+/g)].map(([digits]) => Number(digits));
    const types = TYPES[match[1]!]!;
    if (numbers.length === 1) return [{ type: types.plain, sourceChangeset: numbers[0]! }];
    if (numbers.length === 2) return [{ type: types.interval, sourceChangeset: numbers[1]!, intervalStart: numbers[0]! }];
    return [];
  });
}

/** The merge links of the changes' merge infos (a set: most merged changes share one), each once, in order. */
export function pendingMergeLinks(mergeInfos: ReadonlySet<string>): PendingMergeLink[] {
  const links = new Map<string, PendingMergeLink>();
  for (const mergeInfo of mergeInfos) {
    for (const link of mergeLinksOf(mergeInfo)) links.set(`${link.type}:${link.sourceChangeset}:${link.intervalStart ?? ''}`, link);
  }
  return [...links.values()];
}
