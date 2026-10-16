import type { GraphBranch, GraphChangeset, GraphLabel, MergeLink, MergeLinkType } from '@shared/domain/branchExplorer';
import { recordFormat, type ReadRecord } from './formatRecords';
import type { InternedStrings } from './InternedStrings';

/**
 * `cm find ... --format` layouts for the Branch Explorer. Formatted records are much lighter than XML,
 * which matters for repositories with tens of thousands of branches.
 */
export const BRANCH_FORMAT = recordFormat(['id', 'name', 'parent', 'owner', 'date', 'changeset', 'comment']);
export const CHANGESET_FORMAT = recordFormat(['changesetid', 'branch', 'parent', 'date', 'owner', 'comment']);
export const MERGE_FORMAT = recordFormat(['type', 'srcchangeset', 'dstchangeset']);
export const LABEL_FORMAT = recordFormat(['name', 'changeset', 'owner', 'date', 'comment']);

/** ISO 8601 round-trip dates, so the renderer can parse them. */
export const DATE_FORMAT = 'o';

/**
 * `--dateformat` also applies to the dates written in the query, so a `YYYY-MM-DD` day must be
 * spelled in the round-trip format: local midnight with its UTC offset.
 */
export function roundTripDate(day: string): string {
  const offsetMinutes = -new Date(`${day}T00:00:00`).getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return `${day}T00:00:00.0000000${sign}${hours}:${minutes}`;
}

const MERGE_LINK_TYPES: Record<string, MergeLinkType> = {
  merge: 'merge',
  cherrypick: 'cherryPick',
  cherrypicksubstractive: 'subtractive',
  interval: 'interval',
  intervalcherrypick: 'intervalCherryPick',
  intervalcherrypicksubstractive: 'intervalSubtractive',
};

// What the Branch Explorer builds of each record as it arrives (`CmClient.queryRecords`). The texts many rows repeat
// (owners; branch names, as each changeset names its branch and each branch its parent) are kept once per load.

/** A branch of one `cm find branch`: hidden ones come from a query of their own (`hidden = 'true'`). */
export function graphBranch(isHidden: boolean, strings: InternedStrings): ReadRecord<GraphBranch> {
  return ([id = '', name = '', parent = '', owner = '', date = '', head = '', comment = '']) => ({
    id: toInteger(id),
    name: strings.of(name),
    parent: strings.of(parent),
    owner: strings.of(owner),
    date,
    comment,
    headChangeset: toInteger(head),
    isHidden,
  });
}

export function graphChangeset(strings: InternedStrings): ReadRecord<GraphChangeset> {
  return ([id = '', branch = '', parent = '', date = '', owner = '', comment = '']) => ({
    id: toInteger(id),
    branch: strings.of(branch),
    parent: toInteger(parent),
    date,
    owner: strings.of(owner),
    comment,
  });
}

/** A merge link; one of a type the graph doesn't draw is left out. */
export const graphMergeLink: ReadRecord<MergeLink> = ([type = '', source = '', destination = '']) => {
  const linkType = MERGE_LINK_TYPES[type.toLowerCase()];
  return linkType && { type: linkType, sourceChangeset: toInteger(source), destinationChangeset: toInteger(destination) };
};

export function graphLabel(strings: InternedStrings): ReadRecord<GraphLabel> {
  return ([name = '', changeset = '', owner = '', date = '', comment = '']) => ({
    name,
    changeset: toInteger(changeset),
    owner: strings.of(owner),
    date,
    comment,
  });
}

function toInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}
