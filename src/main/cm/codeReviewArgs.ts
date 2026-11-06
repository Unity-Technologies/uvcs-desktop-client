import type { CodeReviewStatus, CreateCodeReviewRequest } from '@shared/domain/codeReview';
import type { CmPlace } from './cmPlace';

/** `cm codereview <target> <title>`, printing the new review's id; the reviewers it asks, if any, in the same command. */
export function createReviewArgs({ targetSpec, title, reviewers = [] }: CreateCodeReviewRequest, at: CmPlace): string[] {
  return ['codereview', at.spec(targetSpec), title, ...usersOption(reviewers), '--format={id}', ...at.repositoryOption];
}

/** `cm codereview reviewer add`: one command for every user, which `cm` asks one by one. */
export function addReviewersArgs(reviewId: number, users: string[], at: CmPlace): string[] {
  return ['codereview', 'reviewer', 'add', String(reviewId), ...usersOption(users), ...at.repositoryOption];
}

/**
 * `cm codereview review`: the signed-in user's own status. What they say about it, which may hold lines, goes in a
 * file: a `cm shell` line can't carry quotes or line breaks.
 */
export function ownStatusArgs(reviewId: number, status: CodeReviewStatus, commentsFile: string | undefined, at: CmPlace): string[] {
  return ['codereview', 'review', String(reviewId), STATUS_OPTIONS[status], ...(commentsFile ? [`-commentsfile=${commentsFile}`] : []), ...at.repositoryOption];
}

/** `cm codereview -e --title`: a title is one line. */
export function renameReviewArgs(reviewId: number, title: string, at: CmPlace): string[] {
  return ['codereview', '-e', String(reviewId), `--title=${title}`, ...at.repositoryOption];
}

const STATUS_OPTIONS: Record<CodeReviewStatus, string> = {
  'Under review': '--under-review',
  Reviewed: '--reviewed',
  'Rework required': '--rework-required',
};

function usersOption(users: string[]): string[] {
  const names = users.map((user) => user.trim()).filter(Boolean);
  return names.length > 0 ? [`--users=${names.join(',')}`] : [];
}
