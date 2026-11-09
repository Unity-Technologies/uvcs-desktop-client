import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { knownCommentsOrder, type CommentsOrder } from './commentsPanel';

interface ReviewCommentsPreferences {
  /** A review's comments show under their lines in its Changes tab; off, each line has a marker instead. */
  inCode: boolean;
  setInCode: (inCode: boolean) => void;
  /** How the Comments panel orders them: the code's order, grouped by file, unless a time order is chosen. */
  panelOrder: CommentsOrder;
  setPanelOrder: (panelOrder: CommentsOrder) => void;
}

/** How a review's comments show in its code and its Comments panel, for every review: reading code is a habit, not a review's setting. */
export const useReviewCommentsStore = create<ReviewCommentsPreferences>()(
  persist(
    (set) => ({
      inCode: true,
      setInCode: (inCode) => set({ inCode }),
      panelOrder: 'code',
      setPanelOrder: (panelOrder) => set({ panelOrder }),
    }),
    {
      name: 'review-comments',
      version: 0,
      // An order saved by another version that this one doesn't know falls back to the code's.
      merge: (saved, current) => {
        const kept = { ...current, ...(saved as Partial<ReviewCommentsPreferences>) };
        return { ...kept, panelOrder: knownCommentsOrder(kept.panelOrder) };
      },
    },
  ),
);
