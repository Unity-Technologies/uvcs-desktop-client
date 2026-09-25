/** How a merge link was created; mirrors the `type` field of `cm find merge`. */
export type MergeLinkType =
  | 'merge'
  | 'cherryPick'
  | 'subtractive'
  | 'interval'
  | 'intervalCherryPick'
  | 'intervalSubtractive';

export interface GraphChangeset {
  id: number;
  /** Full branch name, e.g. `/main/task`. */
  branch: string;
  /** The previous changeset; on the first changeset of a branch it lives on the parent branch. -1 for the root. */
  parent: number;
  date: string;
  owner: string;
  comment: string;
}

export interface GraphBranch {
  /** Object id, as code reviews name their branches. */
  id: number;
  name: string;
  /** Full name of the parent branch; empty for top-level branches. */
  parent: string;
  owner: string;
  date: string;
  comment: string;
  headChangeset: number;
  isHidden: boolean;
}

export interface MergeLink {
  type: MergeLinkType;
  sourceChangeset: number;
  destinationChangeset: number;
}

export interface GraphLabel {
  name: string;
  changeset: number;
  owner: string;
  date: string;
  comment: string;
}

/** Everything the Branch Explorer draws, restricted to a date range. */
export interface BranchExplorerData {
  branches: GraphBranch[];
  changesets: GraphChangeset[];
  mergeLinks: MergeLink[];
  labels: GraphLabel[];
}

export interface BranchExplorerQuery {
  /** ISO date (`YYYY-MM-DD`); only history from that day on is loaded. Empty loads everything. */
  sinceDate?: string;
  includeHidden: boolean;
}
