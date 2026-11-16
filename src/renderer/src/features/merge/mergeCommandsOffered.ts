/** The palette's merge commands (`useMergeCommands`), in the order they show. */
export const MERGE_COMMAND_IDS = ['merge.fromBranch', 'merge.toBranch', 'merge.cherryPick', 'merge.subtractive', 'merge.applyShelve'] as const;

export type MergeCommandId = (typeof MERGE_COMMAND_IDS)[number];

/**
 * Which merge commands the palette offers: all of them where merges are offered (`offersMerges`), and only Apply
 * shelve in a partial workspace, which merges nothing but shelves work in (`cm partial shelveset`).
 */
export function mergeCommandsOffered(mergesOffered: boolean): MergeCommandId[] {
  return mergesOffered ? [...MERGE_COMMAND_IDS] : ['merge.applyShelve'];
}
