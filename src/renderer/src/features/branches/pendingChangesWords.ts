/** How the switch question refers to the pending changes: "it" for one, "them" for several. */
export function pendingChangesPronoun(count: number): 'it' | 'them' {
  return count === 1 ? 'it' : 'them';
}

/** What undoing pending changes on the way does, wherever it is offered (a switch, downloading the whole branch). */
export const UNDO_CHANGES_DESCRIPTION = 'Your edits are lost, with no shelve to restore. Added files stay in the folder as private files.';
