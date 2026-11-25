import type { ReviewCommentsApi } from '@shared/api/reviewComments';
import type { Place } from '@shared/domain/place';
import type { BranchRef, ReviewConversation, ReviewEvent } from '@shared/domain/reviewConversation';
import { changeRequestGuidCondition, changeRequestThreadOf, FOUND_CHANGE_REQUEST_THREADS } from '../cm/changeRequestThreads';
import { cmPlace } from '../cm/cmPlace';
import { findArgs } from '../cm/findQuery';
import { layoutReader } from '../cm/formatRecords';
import {
  addCommentArgs,
  addImageCommentArgs,
  addModelCommentArgs,
  addLineCommentArgs,
  applyChangeRequestArgs,
  descriptionArgs,
  editCommentArgs,
  removeCommentsArgs,
  replyArgs,
  unapplyChangeRequestArgs,
} from '../cm/reviewCommentArgs';
import { conversationOf, FOUND_REVIEW_COMMENTS, statusCommentText } from '../cm/reviewCommentRecords';
import { withTempFile } from '../files/tempFile';
import type { BranchNamesContext, ServiceContext } from './ServiceContext';

export function createReviewCommentsService({ cm }: ServiceContext, { branchNames }: BranchNamesContext): ReviewCommentsApi {
  /**
   * A merge request's notes name branches by object id (a destination changed, its branch hidden): every id of the
   * conversation named with one lookup (`BranchNamesCache`), none when no note names a branch. Names that can't be
   * read leave the branches by id (the events say what they can): the conversation matters more than the names.
   */
  async function withBranchesNamed(place: Place, conversation: ReviewConversation): Promise<ReviewConversation> {
    const ids = [...new Set(conversation.events.flatMap(branchIdsOf))];
    if (ids.length === 0) return conversation;
    const names = await branchNames.resolve(place, ids).catch(() => new Map<number, string>());
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

    async changeRequestThread(place, guid) {
      const condition = changeRequestGuidCondition(guid);
      if (!condition) return null;
      const at = cmPlace(place);
      const records = await cm.queryRecords(
        findArgs(FOUND_CHANGE_REQUEST_THREADS, {}, null, [condition, "type = 'change'"], at.repository),
        layoutReader(FOUND_CHANGE_REQUEST_THREADS),
        at.options,
      );
      return changeRequestThreadOf(records);
    },

    async add(place, reviewId, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(addCommentArgs(reviewId, textFile, at), at.options));
    },

    async addOnLine(place, reviewId, comment, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(addLineCommentArgs(reviewId, comment, textFile, at), at.options));
    },

    async addOnImage(place, reviewId, comment, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(addImageCommentArgs(reviewId, comment, textFile, at), at.options));
    },

    async addOnModel(place, reviewId, comment, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(addModelCommentArgs(reviewId, comment, textFile, at), at.options));
    },

    async reply(place, commentGuid, text, options) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(replyArgs(commentGuid, textFile, options?.discard ?? false, at), at.options));
    },

    async edit(place, commentGuid, text) {
      const at = cmPlace(place);
      await withTempFile(text, (textFile) => cm.query(editCommentArgs(commentGuid, textFile, at), at.options));
    },

    async editStatusComment(place, commentGuid, status, text) {
      const at = cmPlace(place);
      await withTempFile(statusCommentText(status, text), (textFile) => cm.query(editCommentArgs(commentGuid, textFile, at), at.options));
    },

    async remove(place, commentGuids) {
      const at = cmPlace(place);
      // A long thread runs in a process of its own (`runsLong`: `MAX_QUICK_COMMENT_DELETES`).
      await cm.query(removeCommentsArgs(commentGuids, at), at.options);
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
