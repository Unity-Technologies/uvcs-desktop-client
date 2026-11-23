// What the comment keys do on a stage that takes comments, an image's or a model's alike, and what a click on a
// model's does (an image marks its spots by a click or a drag, in `ImageCommentsOverlay`). The viewers only switch on
// the answer.

/** The state a stage's comment keys and clicks depend on. */
export interface StageCommenting {
  /** The pointer marks a comment's spot (C or the stage's comment button). */
  commenting: boolean;
  /** The stage takes comments now: the version they're written on shows. */
  commentable: boolean;
  /** A comment's card is open. */
  opened: boolean;
}

/** What a comment key does: start or stop marking a spot, close the card open, or nothing (the key goes on). */
export type CommentKeyAction = 'startCommenting' | 'stopCommenting' | 'closeCard' | null;

/**
 * C starts or stops marking a comment's spot where the stage takes comments. Esc stops marking, else closes the card
 * open, else is left to whatever holds the stage (a page going back).
 */
export function commentKeyAction(command: 'comment' | 'leaveComment', state: StageCommenting): CommentKeyAction {
  if (command === 'comment') {
    if (!state.commentable) return null;
    return state.commenting ? 'stopCommenting' : 'startCommenting';
  }
  if (state.commenting) return 'stopCommenting';
  return state.opened ? 'closeCard' : null;
}

/** The modifiers held for a click on the stage. */
export type StageClickModifiers = Pick<MouseEvent, 'altKey'>;

/**
 * What a click on the stage does: while marking, it marks a spot on the version comments are written on (`commentsOn`)
 * and stops marking, whether or not it hits anything; otherwise it's the stage's own click (picking a part). A click
 * marks a point; with Alt (Option on a Mac) held, the whole part under it.
 */
export function stageClickOf<Side>(commenting: boolean, commentsOn: Side | null, modifiers: StageClickModifiers): { marks: Side; wholePart: boolean } | 'stage' {
  return commenting && commentsOn !== null ? { marks: commentsOn, wholePart: modifiers.altKey } : 'stage';
}
