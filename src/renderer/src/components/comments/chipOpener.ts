import { createContext } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';

/**
 * Where a page opens what a comment's chip names, before the chip's own way (`openReference`): true when it did. A code
 * review opens a changeset of its branch in its own Changes (`reviewChipPage`), where the reviewer is; anything else,
 * and a chip anywhere else, opens as it always does.
 */
export type ChipOpener = (reference: CommentReference) => boolean;

export const ChipOpenerContext = createContext<ChipOpener | null>(null);
