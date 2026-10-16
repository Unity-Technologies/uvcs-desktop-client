import type { GraphBranch, GraphChangeset, GraphLabel, MergeLink, MergeLinkType } from '@shared/domain/branchExplorer';
import { recordFormat, type ReadRecord } from './formatRecords';

/**
 * `cm find ... --format` layouts for the Branch Explorer. Formatted records are much lighter than XML,
 * which matters for repositories with tens of thousands of branches.
 */
export const BRANCH_FORMAT = recordFormat(['id', 'name', 'parent', 'owner', 'date', 'changeset', 'comment']);
export const CHANGESET_FORMAT = recordFormat(['changesetid', 'branch', 'parent', 'date', 'owner', 'comment']);
export const MERGE_FORMAT = recordFormat(['type', 'srcchangeset', 'dstchangeset']);
export const LABEL_FORMAT = recordFormat(['name', 'changeset', 'owner', 'date', 'comment']);

const MERGE_LINK_TYPES: Record<string, MergeLinkType> = {
  merge: 'merge',
  cherrypick: 'cherryPick',
  cherrypicksubstractive: 'subtractive',
  interval: 'interval',
  intervalcherrypick: 'intervalCherryPick',
  intervalcherrypicksubstractive: 'intervalSubtractive',
};

// What the Branch Explorer builds of each record as it arrives (`CmClient.queryRecords`).

/** A branch of one `cm find branch`: hidden ones come from a query of their own (`hidden = 'true'`). */
export function graphBranch(isHidden: boolean): ReadRecord<GraphBranch> {
  return ([id = '', name = '', parent = '', owner = '', date = '', head = '', comment = '']) => ({
    id: toInteger(id),
    name,
    parent,
    owner,
    date,
    comment,
    headChangeset: toInteger(head),
    isHidden,
  });
}

export const graphChangeset: ReadRecord<GraphChangeset> = ([id = '', branch = '', parent = '', date = '', owner = '', comment = '']) => ({
  id: toInteger(id),
  branch,
  parent: toInteger(parent),
  date,
  owner,
  comment,
});

/** A merge link; one of a type the graph doesn't draw is left out. */
export const graphMergeLink: ReadRecord<MergeLink> = ([type = '', source = '', destination = '']) => {
  const linkType = MERGE_LINK_TYPES[type.toLowerCase()];
  return linkType ? { type: linkType, sourceChangeset: toInteger(source), destinationChangeset: toInteger(destination) } : undefined;
};

export const graphLabel: ReadRecord<GraphLabel> = ([name = '', changeset = '', owner = '', date = '', comment = '']) => ({
  name,
  changeset: toInteger(changeset),
  owner,
  date,
  comment,
});

function toInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}
