import type { CodeReviewsApi } from '@shared/api/codeReviews';
import { MAX_LISTED_CODE_REVIEWS, type CodeReview, type CodeReviewFilter } from '@shared/domain/codeReview';
import type { QueryFilter } from '@shared/domain/query';
import { branchNamesById } from '../cm/branchNamesById';
import { parseCodeReviews, type RawCodeReview } from '../cm/codeReviewsXml';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import type { ServiceContext } from './ServiceContext';

export function createCodeReviewsService({ cm }: ServiceContext): CodeReviewsApi {
  async function find(workspacePath: string, conditions: string[], filter: QueryFilter): Promise<CodeReview[]> {
    const xml = await cm.query(findArgs('review', filter, 'date desc', conditions), { cwd: workspacePath });
    return resolveTargets(workspacePath, parseCodeReviews(xml));
  }

  /** `cm` reports branch targets only by object id; the names come from a few batched lookups. */
  async function resolveTargets(workspacePath: string, reviews: RawCodeReview[]): Promise<CodeReview[]> {
    const branchIds = reviews.filter((review) => review.targetType === 'branch').map((review) => review.targetId);
    const branchNames = branchIds.length > 0 ? await branchNamesById(cm, workspacePath, branchIds) : new Map<number, string>();

    return reviews.map(({ targetType, targetId, ...review }) => ({
      ...review,
      target:
        targetType === 'changeset'
          ? { kind: 'changeset', changesetId: targetId }
          : targetType === 'branch' && branchNames.has(targetId)
            ? { kind: 'branch', branch: branchNames.get(targetId)! }
            : { kind: 'unknown', description: `${targetType} ${targetId}` },
    }));
  }

  return {
    list(workspacePath, filter: CodeReviewFilter) {
      const conditions = [
        ...(filter.scope === 'assignedToMe' ? ["assignee = 'me'"] : []),
        ...(filter.status ? [`status = '${escapeQueryValue(filter.status)}'`] : []),
      ];
      return find(workspacePath, conditions, {
        owner: filter.scope === 'createdByMe' ? 'me' : undefined,
        sinceDate: filter.sinceDate,
        limit: MAX_LISTED_CODE_REVIEWS,
      });
    },

    async get(workspacePath, reviewId) {
      const [review] = await find(workspacePath, [`id = ${reviewId}`], {});
      if (!review) throw new Error(`Code review ${reviewId} was not found.`);
      return review;
    },

    async create(workspacePath, { targetSpec, title, assignee }) {
      const output = await cm.query(
        ['codereview', targetSpec, title, ...(assignee ? [`--assignee=${assignee}`] : []), '--format={id}'],
        { cwd: workspacePath },
      );
      return Number.parseInt(output.trim(), 10);
    },

    async update(workspacePath, reviewId, { status, assignee }) {
      await cm.query(
        ['codereview', '-e', String(reviewId), ...(status ? [`--status=${status}`] : []), ...(assignee !== undefined ? [`--assignee=${assignee}`] : [])],
        { cwd: workspacePath },
      );
    },

    async remove(workspacePath, reviewIds) {
      await cm.query(['codereview', '-d', ...reviewIds.map(String)], { cwd: workspacePath });
    },
  };
}
