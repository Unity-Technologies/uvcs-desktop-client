import { useState } from 'react';

/**
 * The asset of a diff whose Unity `.meta` shows instead of it (`diffedItem`): set by the ".meta" toggle, the menu's
 * "Open .meta diff" or a link to the meta, and dropped once another file is selected, as in Changes.
 */
export function useDiffMetaShownFor(focusedPath: string | undefined): [string | null, (shownFor: string | null) => void] {
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Adjusted while rendering: another file selected drops it. None selected yet (the files still read) keeps it.
  if (shownFor !== null && focusedPath !== undefined && shownFor !== focusedPath) setShownFor(null);
  return [shownFor, setShownFor];
}
