import type { BranchExplorerData, BranchExplorerQuery } from '../domain/branchExplorer';

export interface BranchExplorerApi {
  load(workspacePath: string, query: BranchExplorerQuery): Promise<BranchExplorerData>;
}
