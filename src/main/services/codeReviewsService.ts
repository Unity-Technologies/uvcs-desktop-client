import type { CodeReviewsApi } from '@shared/api/codeReviews';
import { MAX_LISTED_CODE_REVIEWS, type CodeReview, type CodeReviewFilter } from '@shared/domain/codeReview';
import type { QueryFilter } from '@shared/domain/query';
import { parseCodeReviews, type RawCodeReview } from '../cm/codeReviewsXml';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createCodeReviewsService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): CodeReviewsApi {
  async function findRaw(workspacePath: string, conditions: string[], filter: QueryFilter): Promise<RawCodeReview[]> {
    const xml = await cm.query(findArgs('review', filter, 'date desc', conditions), { cwd: workspacePath });
    return parseCodeReviews(xml);
  }

  async function find(workspacePath: string, conditions: string[], filter: QueryFilter): Promise<CodeReview[]> {
    return resolveTargets(workspacePath, await findRaw(workspacePath, conditions, filter));
  }

  function findListed(workspacePath: string, filter: CodeReviewFilter): Promise<RawCodeReview[]> {
    const conditions = [
      ...(filter.scope === 'assignedToMe' ? ["assignee = 'me'"] : []),
      ...(filter.status ? [`status = '${escapeQueryValue(filter.status)}'`] : []),
    ];
    return findRaw(workspacePath, conditions, {
      owner: filter.scope === 'createdByMe' ? 'me' : undefined,
      sinceDate: filter.sinceDate,
      text: filter.text,
      limit: MAX_LISTED_CODE_REVIEWS,
    });
  }

  /**
   * `cm` reports branch targets only by object id; the names come from the branch lists already read, or from a few
   * batched lookups, remembered a while.
   */
  async function resolveTargets(workspacePath: string, reviews: RawCodeReview[]): Promise<CodeReview[]> {
    const branchIds = reviews.filter((review) => review.targetType === 'branch').map((review) => review.targetId);
    const names = branchIds.length > 0 ? await branchNames.resolve(workspacePath, branchIds) : new Map<number, string>();

    return reviews.map(({ targetType, targetId, ...review }) => ({
      ...review,
      target:
        targetType === 'changeset'
          ? { kind: 'changeset', changesetId: targetId }
          : targetType === 'branch' && names.has(targetId)
            ? { kind: 'branch', branch: names.get(targetId)! }
            : { kind: 'unknown', description: `${targetType} ${targetId}` },
    }));
  }

  return {
    async list(workspacePath, filter) {
      return resolveTargets(workspacePath, await findListed(workspacePath, filter));
    },

    async listSummaries(workspacePath, filter) {
      const reviews = await findListed(workspacePath, filter);
      return reviews.map(({ targetType: _targetType, targetId: _targetId, ...summary }) => summary);
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
      // `cm` succeeds without changing the status of a review nobody is assigned to.
      const [updated] = status ? await findRaw(workspacePath, [`id = ${reviewId}`], {}) : [];
      if (updated && updated.status !== status) {
        throw new Error("cm didn't change the status: it ignores status changes on reviews nobody is assigned to. Assign the review, then try again.");
      }
    },

    async remove(workspacePath, reviewIds) {
      await cm.query(['codereview', '-d', ...reviewIds.map(String)], { cwd: workspacePath });
    },
  };
}
