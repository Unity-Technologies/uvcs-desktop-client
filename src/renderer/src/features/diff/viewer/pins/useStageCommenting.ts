import { useState } from 'react';
import type { CommentKeyAction, StageCommenting } from './stageCommenting';
import { useLeaveCommentCommand } from './useLeaveCommentCommand';
import type { LeaveCommentInput } from './leaveCommentCommands';

/** What a stage's comments need of its annotations: which card is open, and opening or closing one. */
interface OpenedCard {
  opened: string | null;
  onOpen: (key: string | null) => void;
}

/**
 * A stage's comment state, an image's or a model's alike: whether the pointer marks a comment's spot, and what the
 * comment keys do to it (`apply`, for `commentKeyAction`'s answer), with Esc from anywhere in the diff
 * (`useLeaveCommentCommand`).
 */
export function useStageCommenting(shortcut: LeaveCommentInput['shortcut'], annotations: OpenedCard | null, commentable: boolean) {
  const [commenting, setCommenting] = useState(false);
  const state: StageCommenting = { commenting: commenting && commentable, commentable, opened: annotations?.opened != null };
  const apply = (action: NonNullable<CommentKeyAction>): void => {
    if (action === 'closeCard') annotations?.onOpen(null);
    else setCommenting(action === 'startCommenting');
  };
  useLeaveCommentCommand({ shortcut, state, apply });
  return { state, apply, setCommenting };
}
