import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReviewCommentsPreferences {
  /** A review's comments show under their lines in its Changes tab; off, each line has a marker instead. */
  inCode: boolean;
  setInCode: (inCode: boolean) => void;
}

/** How a review's comments show in its code, for every review: reading code is a habit, not a review's setting. */
export const useReviewCommentsStore = create<ReviewCommentsPreferences>()(
  persist(
    (set) => ({
      inCode: true,
      setInCode: (inCode) => set({ inCode }),
    }),
    { name: 'review-comments', version: 0 },
  ),
);
