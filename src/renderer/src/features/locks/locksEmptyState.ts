export interface LocksEmptyState {
  title: string;
  description: string;
  /** Others may hold locks: offer to show them. */
  offerEveryone: boolean;
}

const RULES = "Files matching the server's lock rules are locked when someone checks them out, so nobody else edits them at the same time.";

/** Why the Locks view has no rows: the text typed, only the user's own locks, or no lock at all. */
export function locksEmptyState({ searching, onlyMine }: { searching: boolean; onlyMine: boolean }): LocksEmptyState {
  if (searching) return { title: 'No matching locks', description: 'No path or owner contains this text.', offerEveryone: false };
  return onlyMine ? { title: 'You hold no locks', description: RULES, offerEveryone: true } : { title: 'Nothing is locked', description: RULES, offerEveryone: false };
}
