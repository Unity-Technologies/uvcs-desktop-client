import { create } from 'zustand';
import type { CommentParts } from '../lib/comment';

/**
 * The comment drafts a details panel's editor was left with for another row (`commentEditorExit`'s `keepDraft`), by the
 * object they belong to (`DetailsHeading`'s `draftKey`), for the window's life.
 */
interface CommentDraftStore {
  drafts: Record<string, CommentParts>;
  keep: (key: string, draft: CommentParts) => void;
  /** Drops the object's draft once its editor holds it again. */
  forget: (key: string) => void;
}

export const useCommentDraftStore = create<CommentDraftStore>((set, get) => ({
  drafts: {},
  keep: (key, draft) => set((state) => ({ drafts: { ...state.drafts, [key]: draft } })),
  forget: (key) => {
    if (get().drafts[key]) set((state) => ({ drafts: Object.fromEntries(Object.entries(state.drafts).filter(([kept]) => kept !== key)) }));
  },
}));
