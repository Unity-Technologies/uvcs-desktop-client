import type { BranchExplorerApi } from '@shared/api/branchExplorer';
import type { BranchExplorerQuery } from '@shared/domain/branchExplorer';
import { branchExplorerFinds } from '../cm/branchExplorerFinds';
import { parseBranches, parseChangesets, parseLabels, parseMergeLinks } from '../cm/branchExplorerRecords';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';
import { relevantBranches } from './relevantBranches';

export function createBranchExplorerService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): BranchExplorerApi {
  async function load(workspacePath: string, query: BranchExplorerQuery) {
    const finds = branchExplorerFinds(query);
    const options = { cwd: workspacePath };

    // Merges are the slowest query on big repositories, so they get their own process
    // instead of waiting in line behind the pooled `cm shell` sessions.
    const [branchesOutput, hiddenOutput, changesetsOutput, mergesOutput, labelsOutput] = await Promise.all([
      cm.query(finds.branches, options),
      cm.query(finds.hiddenBranches, options),
      cm.query(finds.changesets, options),
      cm.execute(finds.merges, options),
      cm.query(finds.labels, options),
    ]);

    const visible = parseBranches(branchesOutput, false);
    const hidden = parseBranches(hiddenOutput, true);
    // The code review chips name branches by id (often finished tasks, hidden): these lists answer them.
    branchNames.remember(workspacePath, [...visible, ...hidden], { complete: true });
    const branches = query.includeHidden ? [...visible, ...hidden] : visible;
    const changesets = parseChangesets(changesetsOutput);

    return {
      branches: relevantBranches(branches, changesets, query.sinceDate),
      changesets,
      mergeLinks: parseMergeLinks(mergesOutput),
      labels: parseLabels(labelsOutput),
    };
  }

  return { load };
}
