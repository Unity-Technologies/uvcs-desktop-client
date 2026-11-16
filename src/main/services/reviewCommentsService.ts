import type { ReviewCommentsApi } from '@shared/api/reviewComments';
import type { Place } from '@shared/domain/place';
import type { BranchRef, ReviewConversation, ReviewEvent } from '@shared/domain/reviewConversation';
import { cmPlace } from '../cm/cmPlace';
import { findArgs } from '../cm/findQuery';
import { layoutReader } from '../cm/formatRecords';
import {
  addCommentArgs,
  addLineCommentArgs,
  applyChangeRequestArgs,
  descriptionArgs,
  editCommentArgs,
  removeCommentArgs,
  replyArgs,
  unapplyChangeRequestArgs,
} from '../cm/reviewCommentArgs';
import { conversationOf, FOUND_REVIEW_COMMENTS } from '../cm/reviewCommentRecords';
import { withTempFile } from '../files/tempFile';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createReviewCommentsService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): ReviewCommentsApi {
  /**
   * A merge request's notes name branches by object id (a destination changed, its branch hidden): every id of the
   * conversation named with one lookup (`BranchNamesCache`), none when no note names a branch.
   */
  async function withBranchesNamed(place: Place, conversation: ReviewConversation): Promise<ReviewConversation> {
    const ids = [...new Set(conversation.events.flatMap(branchIdsOf))];
    if (ids.length === 0) return conversation;
    const names = await branchNames.resolve(place, ids);
    return { ...conversation, events: conversation.events.map((event) => withBranchNames(event, names)) };
  }

  return {
    async conversation(place, reviewId) {
      const at = cmPlace(place);
      const records = await cm.queryRecords(
        findArgs(FOUND_REVIEW_COMMENTS, {}, 'date asc', [`reviewid = ${reviewId}`], at.repository),
        layoutReader(FOUND_REVIEW_COMMENTS),
        at.options,
      );
      return withBranchesNamed(place, conversationOf(records));
    },

    async add(place, reviewId, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(addCommentArgs(reviewId, textFile, at), at.options));
    },

    async addOnLine(place, reviewId, comment, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(addLineCommentArgs(reviewId, comment, textFile, at), at.options));
    },

    async reply(place, commentGuid, text, options) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(replyArgs(commentGuid, textFile, options?.discard ?? false, at), at.options));
    },

    async edit(place, commentGuid, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(editCommentArgs(commentGuid, textFile, at), at.options));
    },

    async remove(place, commentGuid) {
      const at = cmPlace(place);
      await cm.query(removeCommentArgs(commentGuid, at), at.options);
    },

    async markApplied(place, changeRequestGuid, changesetId) {
      const at = cmPlace(place);
      await cm.query(applyChangeRequestArgs(changeRequestGuid, changesetId, at), at.options);
    },

    async markNotApplied(place, changeRequestGuid) {
      const at = cmPlace(place);
      await cm.query(unapplyChangeRequestArgs(changeRequestGuid, at), at.options);
    },

    async setDescription(place, reviewId, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(descriptionArgs(reviewId, textFile, at), at.options));
    },
  };
}

function branchIdsOf(event: ReviewEvent): number[] {
  if (event.kind === 'destinationChanged') return [event.from.id, event.to.id];
  if (event.kind === 'branchHidden' || event.kind === 'branchUnhidden') return [event.branch.id];
  return [];
}

function withBranchNames(event: ReviewEvent, names: ReadonlyMap<number, string>): ReviewEvent {
  const named = (branch: BranchRef): BranchRef => {
    const name = names.get(branch.id);
    return name === undefined ? branch : { ...branch, name };
  };
  if (event.kind === 'destinationChanged') return { ...event, from: named(event.from), to: named(event.to) };
  if (event.kind === 'branchHidden' || event.kind === 'branchUnhidden') return { ...event, branch: named(event.branch) };
  return event;
}
