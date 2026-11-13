import { create } from 'zustand';
import type { CodeReviewStatus } from '@shared/domain/codeReview';

interface OwnReviewChoices {
  /** The status picked in each review's "Your review" popover and not sent yet, by the key of its comment's draft. */
  choices: Record<string, CodeReviewStatus>;
  choose: (key: string, status: CodeReviewStatus) => void;
  /** Sent: the popover opens again on the status the user then has. */
  forget: (key: string) => void;
}

/**
 * The other half of the "Your review" popover's draft, while the window lives: its comment is kept under the same key
 * (`commentDraftKey`, in `useCommentDraftStore`). Both are kept as the popover closes (a click elsewhere, to copy
 * something into the comment) and both go once sent, so it never opens again with one and not the other.
 */
export const useOwnReviewChoiceStore = create<OwnReviewChoices>((set, get) => ({
  choices: {},
  choose: (key, status) => set((state) => ({ choices: { ...state.choices, [key]: status } })),
  forget: (key) => {
    if (get().choices[key]) set((state) => ({ choices: Object.fromEntries(Object.entries(state.choices).filter(([kept]) => kept !== key)) }));
  },
}));
