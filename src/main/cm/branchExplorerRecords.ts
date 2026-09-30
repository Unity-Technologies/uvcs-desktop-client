import type { GraphBranch, GraphChangeset, GraphLabel, MergeLink, MergeLinkType } from '@shared/domain/branchExplorer';
import { parseRecords, recordFormat } from './formatRecords';

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

/** Branches of one `cm find branch`: hidden ones come from a query of their own (`hidden = 'true'`). */
export function parseBranches(output: string, isHidden: boolean): GraphBranch[] {
  return parseRecords(output).map(([id = '', name = '', parent = '', owner = '', date = '', head = '', comment = '']) => ({
    id: toInteger(id),
    name,
    parent,
    owner,
    date,
    comment,
    headChangeset: toInteger(head),
    isHidden,
  }));
}

export function parseChangesets(output: string): GraphChangeset[] {
  return parseRecords(output).map(([id = '', branch = '', parent = '', date = '', owner = '', comment = '']) => ({
    id: toInteger(id),
    branch,
    parent: toInteger(parent),
    date,
    owner,
    comment,
  }));
}

export function parseMergeLinks(output: string): MergeLink[] {
  return parseRecords(output).flatMap(([type = '', source = '', destination = '']) => {
    const linkType = MERGE_LINK_TYPES[type.toLowerCase()];
    return linkType ? [{ type: linkType, sourceChangeset: toInteger(source), destinationChangeset: toInteger(destination) }] : [];
  });
}

export function parseLabels(output: string): GraphLabel[] {
  return parseRecords(output).map(([name = '', changeset = '', owner = '', date = '', comment = '']) => ({
    name,
    changeset: toInteger(changeset),
    owner,
    date,
    comment,
  }));
}

function toInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}
