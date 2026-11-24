import { create } from 'zustand';
import type { CodeReviewStatus } from '@shared/domain/codeReview';

/** A status picked in the "Your review" popover and not sent yet, with the one the popover offered when it was picked. */
export interface OwnReviewPick {
  status: CodeReviewStatus;
  /**
   * The status the popover started on then (`OwnReviewButtonState.preselected`): once the user's status changes
   * elsewhere (the review's menu, another window), the pick answered something that's gone (`ownReviewChoice`).
   */
  over: CodeReviewStatus;
}

interface OwnReviewChoices {
  /** Each review's pick, by the key of its comment's draft. */
  choices: Record<string, OwnReviewPick>;
  choose: (key: string, pick: OwnReviewPick) => void;
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
  choose: (key, pick) => set((state) => ({ choices: { ...state.choices, [key]: pick } })),
  forget: (key) => {
    if (get().choices[key]) set((state) => ({ choices: Object.fromEntries(Object.entries(state.choices).filter(([kept]) => kept !== key)) }));
  },
}));
