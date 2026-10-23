import type { BranchExplorerData, BranchExplorerQuery } from '../domain/branchExplorer';
import type { Place } from '../domain/place';

export interface BranchExplorerApi {
  load(place: Place, query: BranchExplorerQuery): Promise<BranchExplorerData>;
}
