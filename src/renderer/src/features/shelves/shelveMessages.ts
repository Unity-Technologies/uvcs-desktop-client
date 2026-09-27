import { pluralize } from '../../lib/text';

/** What applying a shelve did, once done: `count` changes merged (none: the workspace had them), and deleted or kept. */
export function appliedShelveMessage(shelveId: number, count: number, deleted: boolean): string {
  if (count === 0) return deleted ? `Deleted shelve ${shelveId}: its changes were here already` : `Shelve ${shelveId} had nothing new to apply`;
  return deleted ? `Restored ${pluralize(count, 'change')} from shelve ${shelveId}` : `Applied ${pluralize(count, 'change')} from shelve ${shelveId}`;
}

/** The comment of the shelve that takes the pending changes so another shelve can be applied. */
export function setAsideComment(shelveId: number): string {
  return `Set aside to apply shelve ${shelveId}`;
}
