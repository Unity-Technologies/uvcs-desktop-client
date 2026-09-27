export interface ShelvesEmptyState {
  title: string;
  description: string;
  /** Others' shelves may be there: offer to show them. */
  offerEveryone: boolean;
}

/** Why the Shelves view has no rows: the text typed, only the user's own shelves, or none at all. */
export function shelvesEmptyState({ searching, onlyMine }: { searching: boolean; onlyMine: boolean }): ShelvesEmptyState {
  if (searching) return { title: 'No matching shelves', description: 'No number, comment or author contains this text.', offerEveryone: false };
  const description = 'Shelve pending changes from the Changes view to save them without checking in.';
  return onlyMine ? { title: 'You have no shelves', description, offerEveryone: true } : { title: 'No shelves', description, offerEveryone: false };
}
