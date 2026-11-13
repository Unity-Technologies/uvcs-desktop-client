import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../ui/dialog/confirm', () => import('../../../testing/fakeDialogs'));

import { workspacePlace } from '@shared/domain/place';
import { queryClient } from '../../../app/queryClient';
import { answerConfirms } from '../../../testing/fakeDialogs';
import { reviewSubscriptionKey } from '../codeReviewKey';
import { shownToasts, watchRefreshes } from '../../../testing/operationOutcome';
import {
  addLineComment,
  addReviewComment,
  deleteReviewComment,
  discardChangeRequest,
  editReviewComment,
  replyToComment,
  saveReviewDescription,
} from './reviewCommentOperations';

const ws = '/ws';
const inWs = workspacePlace(ws);
const comment = { guid: 'c1' };

describe('writing on a review', () => {
  it('adds, replies, discards, edits and describes, each with one call', async () => {
    for (const method of ['reviewComments.add', 'reviewComments.addOnLine', 'reviewComments.reply', 'reviewComments.edit', 'reviewComments.setDescription'] as const) {
      fakeApi.answer(method, () => undefined);
    }

    expect(await addReviewComment(inWs, 41, 'Nice')).toBe(true);
    expect(await addLineComment(inWs, 41, { revisionId: 30, line: 7, kind: 'question' }, 'Why?')).toBe(true);
    expect(await replyToComment(inWs, comment, 'Thanks')).toBe(true);
    expect(await discardChangeRequest(inWs, comment, 'cm calls it target')).toBe(true);
    expect(await editReviewComment(inWs, comment, 'Nicer')).toBe(true);
    expect(await saveReviewDescription(inWs, 41, '')).toBe(true);

    expect(fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['reviewComments.add', 41, 'Nice'],
      ['reviewComments.addOnLine', 41, { revisionId: 30, line: 7, kind: 'question' }, 'Why?'],
      ['reviewComments.reply', 'c1', 'Thanks'],
      ['reviewComments.reply', 'c1', 'cm calls it target', { discard: true }],
      ['reviewComments.edit', 'c1', 'Nicer'],
      ['reviewComments.setDescription', 41, ''],
    ]);
  });

  it('reads only the reviews again after each write, their lists and conversations, never the workspace', async () => {
    for (const method of ['reviewComments.add', 'reviewComments.addOnLine', 'reviewComments.reply', 'reviewComments.edit', 'reviewComments.remove', 'reviewComments.setDescription'] as const) {
      fakeApi.answer(method, () => undefined);
    }
    answerConfirms(true);
    const writes = [
      () => addReviewComment(inWs, 41, 'Nice'),
      () => addLineComment(inWs, 41, { revisionId: 30, line: 7, kind: 'changeRequest' }, 'Rename it'),
      () => replyToComment(inWs, comment, 'Thanks'),
      () => discardChangeRequest(inWs, comment, 'Not needed'),
      () => editReviewComment(inWs, comment, 'Nicer'),
      () => deleteReviewComment(inWs, comment),
      () => saveReviewDescription(inWs, 41, 'Why'),
    ];

    for (const write of writes) {
      const refreshed = watchRefreshes(ws);
      await write();
      expect(refreshed()).toEqual(['codeReviews']);
    }
  });

  it('says it failed and keeps the text to try again', async () => {
    fakeApi.answer('reviewComments.reply', () => {
      throw new Error('The comment was deleted');
    });

    expect(await replyToComment(inWs, comment, 'Thanks')).toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't reply", detail: 'The comment was deleted' }]);
  });

  it('deletes a comment once confirmed, and nothing otherwise', async () => {
    fakeApi.answer('reviewComments.remove', () => undefined);

    answerConfirms(false);
    expect(await deleteReviewComment(inWs, comment)).toBe(false);
    answerConfirms(true);
    expect(await deleteReviewComment(inWs, comment)).toBe(true);

    expect(fakeApi.argsOf('reviewComments.remove')).toEqual([[inWs, 'c1']]);
  });
});

describe("what a write reads again of the user's email subscription", () => {
  // The server subscribes whoever writes a comment, a reply among them (a discard is one): it may have unsubscribed them.
  const subscriptionReadAgainAfter = async (write: () => Promise<boolean>) => {
    queryClient.setQueryData(reviewSubscriptionKey(inWs, 41), { subscribed: false, reason: 'unsubscribed', emailsEnabled: true });
    await write();
    return queryClient.getQueryState(reviewSubscriptionKey(inWs, 41))?.isInvalidated;
  };

  it('reads it again after the user comments, on the review, on a line or in reply', async () => {
    for (const method of ['reviewComments.add', 'reviewComments.addOnLine', 'reviewComments.reply'] as const) fakeApi.answer(method, () => undefined);

    expect(await subscriptionReadAgainAfter(() => addReviewComment(inWs, 41, 'Nice'))).toBe(true);
    expect(await subscriptionReadAgainAfter(() => addLineComment(inWs, 41, { revisionId: 30, line: 7, kind: 'question' }, 'Why?'))).toBe(true);
    expect(await subscriptionReadAgainAfter(() => replyToComment(inWs, comment, 'Thanks'))).toBe(true);
    expect(await subscriptionReadAgainAfter(() => discardChangeRequest(inWs, comment, 'Not needed'))).toBe(true);
  });

  it('leaves it after an edit, a delete or a description', async () => {
    for (const method of ['reviewComments.edit', 'reviewComments.remove', 'reviewComments.setDescription'] as const) fakeApi.answer(method, () => undefined);
    answerConfirms(true);

    expect(await subscriptionReadAgainAfter(() => editReviewComment(inWs, comment, 'Nicer'))).toBe(false);
    expect(await subscriptionReadAgainAfter(() => deleteReviewComment(inWs, comment))).toBe(false);
    expect(await subscriptionReadAgainAfter(() => saveReviewDescription(inWs, 41, 'What it does'))).toBe(false);
  });
});
