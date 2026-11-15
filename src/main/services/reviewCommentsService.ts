import type { ReviewCommentsApi } from '@shared/api/reviewComments';
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
import type { ServiceContext } from './ServiceContext';

export function createReviewCommentsService({ cm }: ServiceContext): ReviewCommentsApi {
  return {
    async conversation(place, reviewId) {
      const at = cmPlace(place);
      const records = await cm.queryRecords(
        findArgs(FOUND_REVIEW_COMMENTS, {}, 'date asc', [`reviewid = ${reviewId}`], at.repository),
        layoutReader(FOUND_REVIEW_COMMENTS),
        at.options,
      );
      return conversationOf(records);
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
