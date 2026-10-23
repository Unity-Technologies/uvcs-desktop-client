import { workspacePlace } from '@shared/domain/place';
import type { BranchExplorerApi } from '@shared/api/branchExplorer';
import type { BranchExplorerQuery } from '@shared/domain/branchExplorer';
import { branchExplorerFinds } from '../cm/branchExplorerFinds';
import { graphBranch, graphChangeset, graphLabel, graphMergeLink } from '../cm/branchExplorerRecords';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';
import { relevantBranches } from './relevantBranches';

export function createBranchExplorerService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): BranchExplorerApi {
  async function load(workspacePath: string, query: BranchExplorerQuery) {
    const finds = branchExplorerFinds(query);
    const options = { cwd: workspacePath };
    // Each record is read as it arrives: a big repository's answers are hundreds of MB, never held whole. Merges are the
    // slowest query on big repositories, so they get their own process instead of waiting in line behind the pooled
    // `cm shell` sessions.
    const [visible, hidden, changesets, mergeLinks, labels] = await Promise.all([
      cm.queryRecords(finds.branches, graphBranch(false), options),
      cm.queryRecords(finds.hiddenBranches, graphBranch(true), options),
      cm.queryRecords(finds.changesets, graphChangeset, options),
      cm.executeRecords(finds.merges, graphMergeLink, options),
      cm.queryRecords(finds.labels, graphLabel, options),
    ]);

    // The code review chips name branches by id (often finished tasks, hidden): these lists answer them.
    branchNames.remember(workspacePlace(workspacePath), [...visible, ...hidden], { complete: true });
    const branches = query.includeHidden ? [...visible, ...hidden] : visible;

    return { branches: relevantBranches(branches, changesets, query.sinceDate), changesets, mergeLinks, labels };
  }

  return { load };
}
