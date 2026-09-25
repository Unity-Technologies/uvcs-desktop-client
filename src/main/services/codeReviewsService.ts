import type { CodeReviewsApi } from '@shared/api/codeReviews';
import type { CodeReview, CodeReviewFilter } from '@shared/domain/codeReview';
import { parseCodeReviews, type RawCodeReview } from '../cm/codeReviewsXml';
import { findRecords, toBranch } from '../cm/findObjects';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import type { ServiceContext } from './ServiceContext';

export function createCodeReviewsService({ cm }: ServiceContext): CodeReviewsApi {
  async function find(workspacePath: string, conditions: string[], owner?: string): Promise<CodeReview[]> {
    const xml = await cm.query(findArgs('review', { owner }, 'date desc', conditions), { cwd: workspacePath });
    return resolveTargets(workspacePath, parseCodeReviews(xml));
  }

  /** Branch targets come as object ids; look their names up in a single query. */
  async function resolveTargets(workspacePath: string, reviews: RawCodeReview[]): Promise<CodeReview[]> {
    const branchIds = [...new Set(reviews.filter((review) => review.targetType === 'branch').map((review) => review.targetId))];
    const branchNames = new Map<number, string>();
    if (branchIds.length > 0) {
      const where = `where ${branchIds.map((id) => `id = ${id}`).join(' or ')}`;
      const xml = await cm.query(['find', 'branch', where, '--xml', '--nototal'], { cwd: workspacePath });
      findRecords(xml, 'BRANCH').map(toBranch).forEach((branch) => branchNames.set(branch.id, branch.name));
    }

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
      return find(workspacePath, conditions, filter.scope === 'createdByMe' ? 'me' : undefined);
    },

    async get(workspacePath, reviewId) {
      const [review] = await find(workspacePath, [`id = ${reviewId}`]);
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
