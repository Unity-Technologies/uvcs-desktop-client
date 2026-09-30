import type { BranchExplorerQuery } from '@shared/domain/branchExplorer';
import { BRANCH_FORMAT, CHANGESET_FORMAT, DATE_FORMAT, LABEL_FORMAT, MERGE_FORMAT, roundTripDate } from './branchExplorerRecords';
import { whereClause } from './findQuery';

/**
 * The `cm find` commands that load the Branch Explorer. `cm find branch` leaves hidden branches out unless asked for
 * (`hidden = 'true'`), and `cm find changeset` their changesets (`ignorehidden = 'true'` brings them in).
 * Hidden branches are always read, few as they are: the code review chips name them by id.
 */
export function branchExplorerFinds(query: BranchExplorerQuery): Record<'branches' | 'hiddenBranches' | 'changesets' | 'merges' | 'labels', string[]> {
  const find = (object: string, where: string, format: string): string[] =>
    ['find', object, where, `--format=${format}`, `--dateformat=${DATE_FORMAT}`, '--nototal'].filter(Boolean);
  const range = { sinceDate: query.sinceDate && roundTripDate(query.sinceDate) };
  const inRange = whereClause(range);
  return {
    branches: find('branch', '', BRANCH_FORMAT),
    hiddenBranches: find('branch', "where hidden = 'true'", BRANCH_FORMAT),
    changesets: find('changeset', whereClause(range, query.includeHidden ? ["ignorehidden = 'true'"] : []), CHANGESET_FORMAT),
    merges: find('merge', inRange, MERGE_FORMAT),
    labels: find('label', inRange, LABEL_FORMAT),
  };
}
