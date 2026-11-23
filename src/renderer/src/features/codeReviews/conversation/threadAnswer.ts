import type { CommentParts } from '../../../lib/comment';

export type Answering = 'reply' | 'discard';

export interface AnswerBox {
  answering: Answering | null;
  focuses: boolean;
}

export interface AnswerDrafts {
  reply: CommentParts | undefined;
  discard: CommentParts | undefined;
}

export function keepsAnswerDraft(draft: CommentParts | undefined): boolean {
  return false;
}

export function answerShownOnReturn(drafts: AnswerDrafts, discardable: boolean): AnswerBox {
  return { answering: null, focuses: false };
}

export function answerOpenedByHand(answering: Answering): AnswerBox {
  return { answering, focuses: false };
}
