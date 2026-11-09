import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../ui/dialog/confirm', () => import('../../../testing/fakeDialogs'));

import { workspacePlace } from '@shared/domain/place';
import { answerConfirms } from '../../../testing/fakeDialogs';
import { shownToasts, watchRefreshes } from '../../../testing/operationOutcome';
import {
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
    for (const method of ['reviewComments.add', 'reviewComments.reply', 'reviewComments.edit', 'reviewComments.setDescription'] as const) {
      fakeApi.answer(method, () => undefined);
    }

    expect(await addReviewComment(inWs, 41, 'Nice')).toBe(true);
    expect(await replyToComment(inWs, comment, 'Thanks')).toBe(true);
    expect(await discardChangeRequest(inWs, comment, 'cm calls it target')).toBe(true);
    expect(await editReviewComment(inWs, comment, 'Nicer')).toBe(true);
    expect(await saveReviewDescription(inWs, 41, '')).toBe(true);

    expect(fakeApi.calls().map(({ method, args }) => [method, ...args.slice(1)])).toEqual([
      ['reviewComments.add', 41, 'Nice'],
      ['reviewComments.reply', 'c1', 'Thanks'],
      ['reviewComments.reply', 'c1', 'cm calls it target', { discard: true }],
      ['reviewComments.edit', 'c1', 'Nicer'],
      ['reviewComments.setDescription', 41, ''],
    ]);
  });

  it('reads only the reviews again after each write, their lists and conversations, never the workspace', async () => {
    for (const method of ['reviewComments.add', 'reviewComments.reply', 'reviewComments.edit', 'reviewComments.remove', 'reviewComments.setDescription'] as const) {
      fakeApi.answer(method, () => undefined);
    }
    answerConfirms(true);
    const writes = [
      () => addReviewComment(inWs, 41, 'Nice'),
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
