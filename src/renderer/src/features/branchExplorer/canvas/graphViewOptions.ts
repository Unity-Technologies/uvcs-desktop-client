/** What the user chose to see in the graph: the Branch Explorer's display options. */
export interface GraphViewOptions {
  /** Each branch's band behind its changesets; off, a thin line in its color joins them. */
  showBranches: boolean;
  /** Branch names with their parents (`/main/task`); off, only the last part (`task`). */
  fullBranchNames: boolean;
  /** Each branch in its own color; off, every branch in one. */
  branchColors: boolean;
  /** The links from where a branch starts to its first changeset. */
  showBranchStartLinks: boolean;
  /** The links from a merge's source to its destination. */
  showMergeLinks: boolean;
  /** Labels on their changesets. */
  showLabels: boolean;
  /** Changeset comments under the changesets. */
  showComments: boolean;
  /** Avatars with initials instead of plain dots. */
  showAvatars: boolean;
}

export type GraphViewOption = keyof GraphViewOptions;

/** Everything shows until the user turns it off. */
export const DEFAULT_GRAPH_VIEW_OPTIONS: GraphViewOptions = {
  showBranches: true,
  fullBranchNames: true,
  branchColors: true,
  showBranchStartLinks: true,
  showMergeLinks: true,
  showLabels: true,
  showComments: true,
  showAvatars: true,
};

export interface GraphViewOptionGroup {
  title: string;
  options: readonly { option: GraphViewOption; label: string }[];
}

/** The display options as the options dialog lists them, in its groups and order. */
export const GRAPH_VIEW_OPTION_GROUPS: readonly GraphViewOptionGroup[] = [
  {
    title: 'Branches',
    options: [
      { option: 'showBranches', label: 'Branches' },
      { option: 'fullBranchNames', label: 'Full branch names' },
      { option: 'branchColors', label: 'Branch colors' },
    ],
  },
  {
    title: 'Links',
    options: [
      { option: 'showBranchStartLinks', label: 'Branch starts' },
      { option: 'showMergeLinks', label: 'Merges' },
    ],
  },
  {
    title: 'Changesets',
    options: [
      { option: 'showLabels', label: 'Labels' },
      { option: 'showComments', label: 'Comments' },
      { option: 'showAvatars', label: 'Avatars' },
    ],
  },
];

/** The display options out of a larger object, such as the stored preferences, so the scene changes only with them. */
export function graphViewOptionsOf(source: GraphViewOptions): GraphViewOptions {
  const options = { ...DEFAULT_GRAPH_VIEW_OPTIONS };
  for (const key of Object.keys(options) as GraphViewOption[]) options[key] = source[key];
  return options;
}

/** Whether any display option differs from its default: Restore defaults is enabled only then. */
export function hidesAnything(options: GraphViewOptions): boolean {
  return (Object.keys(DEFAULT_GRAPH_VIEW_OPTIONS) as GraphViewOption[]).some((key) => options[key] !== DEFAULT_GRAPH_VIEW_OPTIONS[key]);
}
