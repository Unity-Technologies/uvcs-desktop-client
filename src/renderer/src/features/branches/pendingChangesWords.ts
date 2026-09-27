/** How the switch question refers to the pending changes: "it" for one, "them" for several. */
export function pendingChangesPronoun(count: number): 'it' | 'them' {
  return count === 1 ? 'it' : 'them';
}
