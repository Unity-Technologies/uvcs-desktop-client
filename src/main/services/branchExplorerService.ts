import type { BranchExplorerApi } from '@shared/api/branchExplorer';
import type { BranchExplorerQuery, RuleMatch, RuleQuery } from '@shared/domain/branchExplorer';
import type { Place } from '@shared/domain/place';
import { branchExplorerFinds } from '../cm/branchExplorerFinds';
import { CmError } from '../cm/CmError';
import { cmPlace } from '../cm/cmPlace';
import { graphBranch, graphChangeset, graphLabel, graphMergeLink } from '../cm/branchExplorerRecords';
import { matchedObject, ruleMatchFind } from '../cm/ruleMatchFind';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';
import { relevantBranches } from './relevantBranches';

export function createBranchExplorerService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): BranchExplorerApi {
  async function load(place: Place, query: BranchExplorerQuery) {
    const at = cmPlace(place);
    const finds = branchExplorerFinds(query, at.repository);
    const { options } = at;
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
    branchNames.remember(place, [...visible, ...hidden], { complete: true });
    const branches = query.includeHidden ? [...visible, ...hidden] : visible;

    return { branches: relevantBranches(branches, changesets, query.sinceDate), changesets, mergeLinks, labels };
  }

  /**
   * One `cm find` per rule, all at once: a rule's condition is the user's own, so `cm` may refuse it, and that rule
   * alone answers the error while the others still apply. The finds have no date range or `limit`, since a rule must
   * hold for every branch, changeset or label the graph may draw; each prints one field per object it matched
   * (`ruleMatchFind`), read as records as they arrive, and runs again only on a rule change or a refresh.
   */
  async function matchRules(place: Place, queries: readonly RuleQuery[]): Promise<RuleMatch[]> {
    const { repository, options } = cmPlace(place);
    return Promise.all(
      queries.map(async (query): Promise<RuleMatch> => {
        try {
          return { matched: await cm.queryRecords(ruleMatchFind(query, repository), matchedObject, options) };
        } catch (error) {
          if (error instanceof CmError) return { error: error.message };
          throw error;
        }
      }),
    );
  }

  return { load, matchRules };
}
