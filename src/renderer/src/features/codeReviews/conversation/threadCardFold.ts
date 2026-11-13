import type { ReviewThread } from './reviewThreads';
import { startsFolded } from './threadBadges';

/** Whether a thread's card is folded, and whether its first comment opens in its editor when it shows whole. */
export interface ThreadCardFold {
  folded: boolean;
  /** Edit was picked on the folded header (`FirstCommentMenu`): spent once the editor opens (`editorOpened`). */
  editsRoot: boolean;
}

/**
 * What changes it: its chevron (`toggle`); anything else that shows it whole (`unfold`: its folded line, going to it,
 * its Answered pill); Edit on the folded header (`editRoot`); the first comment's editor, opened (`editorOpened`).
 */
export type ThreadCardFoldEvent = 'toggle' | 'unfold' | 'editRoot' | 'editorOpened';

/** A settled thread starts folded (`startsFolded`), unless it's gone to (`highlight`), which shows it whole. */
export function initialThreadCardFold(thread: Pick<ReviewThread, 'state'>, highlight: number | undefined): ThreadCardFold {
  return { folded: startsFolded(thread) && highlight === undefined, editsRoot: false };
}

export function nextThreadCardFold(state: ThreadCardFold, event: ThreadCardFoldEvent): ThreadCardFold {
  switch (event) {
    case 'toggle':
      // Folding drops an edit still waiting, so unfolding later opens no editor.
      return { folded: !state.folded, editsRoot: false };
    case 'unfold':
      return state.folded ? { ...state, folded: false } : state;
    case 'editRoot':
      return { folded: false, editsRoot: true };
    case 'editorOpened':
      return state.editsRoot ? { ...state, editsRoot: false } : state;
  }
}
