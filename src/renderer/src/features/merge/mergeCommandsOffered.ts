import { offersMerges, offersServerMerges, type MenuPlace } from '../../components/mergesOffered';

/** The palette's merge commands (`useMergeCommands`), in the order they show. */
export const MERGE_COMMAND_IDS = ['merge.fromBranch', 'merge.toBranch', 'merge.cherryPick', 'merge.applyShelve', 'merge.subtractive'] as const;

export type MergeCommandId = (typeof MERGE_COMMAND_IDS)[number];

/**
 * Which merge commands the palette offers: every one in a workspace that takes merges (`offersMerges`); in a partial
 * workspace, the merge on the server (`offersServerMerges`) and applying a shelve.
 */
export function mergeCommandsOffered(where: MenuPlace): MergeCommandId[] {
  const intoWorkspace = offersMerges(where);
  const onServer = offersServerMerges(where);
  return MERGE_COMMAND_IDS.filter((id) => id === 'merge.applyShelve' || (id === 'merge.toBranch' ? onServer : intoWorkspace));
}
