// What the user builds up in the Branch Explorer and the app keeps in its settings (`AppSettings`,
// `RepositorySettings`): the advanced rules and the branches moved, per repository, and the changeset colors by user.
// The renderer's `features/branchExplorer/model/` decides what they do; these are only their shapes.

/**
 * The Branch Explorer's advanced rules, applied in order. Inclusions keep only the branches they match, exclusions hide
 * the branches they match (and win over inclusions), and format rules color what they match (a later rule over an
 * earlier one). Every rule but the two built-in formats asks the server with a `cm find` condition.
 */
export type ExplorerRuleKind = 'include' | 'exclude' | 'branchFormat' | 'changesetFormat' | 'labelFormat' | 'pendingMerges' | 'currentBranch';

/** Which relatives of the branches an inclusion or exclusion matches it takes with them. */
export interface RuleExpansion {
  /** Every branch below them. */
  children: boolean;
  /** The branch each one starts from. */
  parent: boolean;
  /** The branches merged into them. */
  mergeSources: boolean;
  /** The branches they were merged into. */
  mergeDestinations: boolean;
}

export interface ExplorerRule {
  id: string;
  kind: ExplorerRuleKind;
  enabled: boolean;
  description: string;
  /** A `cm find` condition without `where` (`owner = 'me'`); empty for the built-in formats, which need none. */
  condition: string;
  /** For inclusions and exclusions only. */
  expansion: RuleExpansion;
  /** One of `BRANCH_HUES`, for format rules only. */
  hue: number | null;
}

/** A branch the user moved: the row it asks for, by its object id (a name changes with a rename). */
export interface BranchPin {
  branch: number;
  row: number;
}

/** The branches moved, the one moved last at the end: where two want the same room, it wins (`placeLanes`). */
export type BranchPins = readonly BranchPin[];

/** The hue a person's changesets take. */
export interface UserColor {
  /** As `cm` stores the owner: `jane@example.com`. */
  user: string;
  hue: number;
}

/**
 * The changeset colors by user, the same in every repository: people keep their color wherever they work. Whether they
 * apply is each repository's own (`appliedUserColorsOf`).
 */
export interface UserColors {
  users: readonly UserColor[];
}
