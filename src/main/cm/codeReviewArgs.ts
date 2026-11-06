import type { CodeReviewStatus, CreateCodeReviewRequest } from '@shared/domain/codeReview';
import type { MemberKind, MemberRef } from '@shared/domain/member';
import type { CmPlace } from './cmPlace';
import { LISTED_REVIEWERS } from './codeReviewRecords';
import { layoutFormat } from './formatRecords';

/** `cm codereview <target> <title>`, printing the new review's id; the reviewers it asks, if any, in the same command. */
export function createReviewArgs({ targetSpec, title, reviewers = [] }: CreateCodeReviewRequest, at: CmPlace): string[] {
  return ['codereview', at.spec(targetSpec), title, ...reviewersOptions(reviewers), '--format={id}', ...at.repositoryOption];
}

/** `cm codereview reviewer list`: the review's reviewers, each with its status and whether it's a user or a group. */
export function listReviewersArgs(reviewId: number, at: CmPlace): string[] {
  return ['codereview', 'reviewer', 'list', String(reviewId), layoutFormat(LISTED_REVIEWERS), ...at.repositoryOption];
}

/** `cm codereview reviewer add`: one command for every user and group, which `cm` asks one by one. */
export function addReviewersArgs(reviewId: number, reviewers: readonly MemberRef[], at: CmPlace): string[] {
  return ['codereview', 'reviewer', 'add', String(reviewId), ...reviewersOptions(reviewers), ...at.repositoryOption];
}

/** `cm codereview reviewer remove`: one command for every user and group; the other reviewers stay. */
export function removeReviewersArgs(reviewId: number, reviewers: readonly MemberRef[], at: CmPlace): string[] {
  return ['codereview', 'reviewer', 'remove', String(reviewId), ...reviewersOptions(reviewers), ...at.repositoryOption];
}

/** `cm codereview review --re-request`: the reviewers named go back to "Under review", asked to review it again. */
export function reRequestReviewArgs(reviewId: number, reviewers: readonly MemberRef[], at: CmPlace): string[] {
  return ['codereview', 'review', String(reviewId), '--re-request', ...reviewersOptions(reviewers), ...at.repositoryOption];
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

/**
 * The reviewers named, users in `--users` and groups in `--groups`, both in one command: `cm` looks a name up among
 * its option's kind only (a group in `--users` fails, "No such user"). An option that would name nobody is left out.
 */
function reviewersOptions(reviewers: readonly MemberRef[]): string[] {
  return [namesOption('--users', reviewers, 'user'), namesOption('--groups', reviewers, 'group')].filter((option) => option !== undefined);
}

function namesOption(option: string, reviewers: readonly MemberRef[], kind: MemberKind): string | undefined {
  const names = reviewers.filter((reviewer) => reviewer.kind === kind).map((reviewer) => reviewer.name.trim()).filter(Boolean);
  return names.length > 0 ? `${option}=${names.join(',')}` : undefined;
}
