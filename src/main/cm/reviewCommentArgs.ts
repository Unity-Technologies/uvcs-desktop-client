import type { CmPlace } from './cmPlace';

// Every text goes in a file: a comment holds lines, and a `cm shell` line can't carry quotes or line breaks.

/** `cm codereview comment add`: a comment on the whole review. */
export function addCommentArgs(reviewId: number, textFile: string, at: CmPlace): string[] {
  return ['codereview', 'comment', 'add', String(reviewId), `-commentsfile=${textFile}`, ...at.repositoryOption];
}

/** `cm codereview comment reply`: the server places the reply where the comment it answers is. */
export function replyArgs(commentGuid: string, textFile: string, discard: boolean, at: CmPlace): string[] {
  return ['codereview', 'comment', 'reply', commentGuid, `-commentsfile=${textFile}`, ...(discard ? ['--discard'] : []), ...at.repositoryOption];
}

/** `cm codereview comment edit`: the text only; the comment keeps its kind and where it is. */
export function editCommentArgs(commentGuid: string, textFile: string, at: CmPlace): string[] {
  return ['codereview', 'comment', 'edit', commentGuid, `-commentsfile=${textFile}`, ...at.repositoryOption];
}

export function removeCommentArgs(commentGuid: string, at: CmPlace): string[] {
  return ['codereview', 'comment', 'delete', commentGuid, ...at.repositoryOption];
}

/** `cm codereview -e --descriptionfile`: writes the description, adds it to a review with none, an empty one clears it. */
export function descriptionArgs(reviewId: number, textFile: string, at: CmPlace): string[] {
  return ['codereview', '-e', String(reviewId), `--descriptionfile=${textFile}`, ...at.repositoryOption];
}
