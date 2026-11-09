import type { BranchExplorerData, BranchExplorerQuery, RuleMatch, RuleQuery } from '../domain/branchExplorer';
import type { Place } from '../domain/place';

export interface BranchExplorerApi {
  load(place: Place, query: BranchExplorerQuery): Promise<BranchExplorerData>;
  /** What each rule's condition matches, in the order asked; a condition `cm` refuses answers its error alone. */
  matchRules(place: Place, queries: readonly RuleQuery[]): Promise<RuleMatch[]>;
}
