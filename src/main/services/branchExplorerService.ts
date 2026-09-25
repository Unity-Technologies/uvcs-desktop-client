import type { BranchExplorerApi } from '@shared/api/branchExplorer';
import type { BranchExplorerQuery } from '@shared/domain/branchExplorer';
import {
  BRANCH_FORMAT,
  CHANGESET_FORMAT,
  DATE_FORMAT,
  LABEL_FORMAT,
  MERGE_FORMAT,
  NAME_FORMAT,
  parseBranches,
  parseChangesets,
  parseLabels,
  parseMergeLinks,
  parseNames,
  roundTripDate,
} from '../cm/branchExplorerRecords';
import { whereClause } from '../cm/findQuery';
import type { ServiceContext } from './ServiceContext';
import { relevantBranches } from './relevantBranches';

export function createBranchExplorerService({ cm }: ServiceContext): BranchExplorerApi {
  async function load(workspacePath: string, query: BranchExplorerQuery) {
    const find = (object: string, where: string, format: string): string[] =>
      ['find', object, where, `--format=${format}`, `--dateformat=${DATE_FORMAT}`, '--nototal'].filter(Boolean);
    const inRange = whereClause({ sinceDate: query.sinceDate && roundTripDate(query.sinceDate) });
    const options = { cwd: workspacePath };

    // Merges are the slowest query on big repositories, so they get their own process
    // instead of waiting in line behind the pooled `cm shell` sessions.
    const [branchesOutput, hiddenOutput, changesetsOutput, mergesOutput, labelsOutput] = await Promise.all([
      cm.query(find('branch', '', BRANCH_FORMAT), options),
      cm.query(find('branch', "where hidden = 'true'", NAME_FORMAT), options),
      cm.query(find('changeset', inRange, CHANGESET_FORMAT), options),
      cm.execute(find('merge', inRange, MERGE_FORMAT), options),
      cm.query(find('label', inRange, LABEL_FORMAT), options),
    ]);

    const hiddenNames = parseNames(hiddenOutput);
    const changesets = parseChangesets(changesetsOutput).filter(
      (changeset) => query.includeHidden || !hiddenNames.has(changeset.branch),
    );
    const branches = parseBranches(branchesOutput, hiddenNames).filter((branch) => query.includeHidden || !branch.isHidden);

    return {
      branches: relevantBranches(branches, changesets, query.sinceDate),
      changesets,
      mergeLinks: parseMergeLinks(mergesOutput),
      labels: parseLabels(labelsOutput),
    };
  }

  return { load };
}
