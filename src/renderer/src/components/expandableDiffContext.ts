import { createContext } from 'react';

/**
 * Whether the diffs under it can expand to the whole window (Expand Diff, `diffExpansion.ts`): a host that lays itself
 * out for it, hiding its files and headers while the diff is expanded (Changes, a diff page, History, Incoming, a
 * file's content in Files and Browse repository), says so around its diff. Elsewhere (the merge page) the diff's header
 * offers no Expand button.
 */
export const ExpandableDiffContext = createContext(false);
