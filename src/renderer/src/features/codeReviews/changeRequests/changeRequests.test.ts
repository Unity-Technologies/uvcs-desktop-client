import { describe, expect, it } from 'vitest';
import type { ReviewComment, ReviewConversation } from '@shared/domain/reviewConversation';
import { codeReviewSummary } from '../../../testing/codeReviewSummary';
import { branchChangeRequestsOf, changeRequestChip, changeRequestNamed, changeRequestsBranch, changeRequestsOf, notYetNamed, reviewsToRead, stillOpen } from './changeRequests';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `c0d1ce${String(id).padStart(2, '0')}-b457-4424-99ff-a3f1c0fa2582`, author: 'ana', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00+01:00`, text: `Request ${id}`, kind: 'changeRequest', anchor: ON_LINE, ...fields };
}

const conversationOf = (...comments: ReviewComment[]): ReviewConversation => ({ comments, events: [] });

describe('changeRequestsOf', () => {
  it("reads each change request of a review with where it stands, as the review's threads do", () => {
    const requests = changeRequestsOf(
      43,
      conversationOf(
        comment(1),
        comment(2, { appliedInChangeset: 7 }),
        comment(3),
        comment(4, { kind: 'discard', parentId: 3 }),
        comment(5, { kind: 'question' }),
        comment(6, { kind: 'general', anchor: { kind: 'review' } }),
      ),
    );

    expect(requests.map(({ commentId, state }) => [commentId, state])).toEqual([
      [1, { kind: 'open' }],
      [2, { kind: 'applied', changesetId: 7 }],
      [3, { kind: 'discarded' }],
    ]);
    expect(requests[0]).toMatchObject({ reviewId: 43, guid: comment(1).guid, author: 'ana', text: 'Request 1', location: { path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } });
  });

  it('gives a request on the whole review no location, and reads a conversation once', () => {
    const conversation = conversationOf(comment(1, { anchor: { kind: 'review' } }));

    expect(changeRequestsOf(43, conversation)[0]?.location).toBeUndefined();
    expect(changeRequestsOf(43, conversation)).toBe(changeRequestsOf(43, conversation));
  });
});

describe('reviewsToRead', () => {
  it('reads every review with something open, the newest first', () => {
    const reviews = [5, 9, 7, 8, 6].map((id) => codeReviewSummary({ id, openIssueCount: id === 6 ? 0 : 1 }));

    expect(reviewsToRead(reviews)).toEqual([9, 8, 7, 5]);
  });

  it('reads none for a branch with no review, or none with anything open', () => {
    expect(reviewsToRead([])).toEqual([]);
    expect(reviewsToRead([codeReviewSummary({ id: 4, openIssueCount: 0 })])).toEqual([]);
  });
});

describe('stillOpen', () => {
  it('keeps the open ones of every review read, the newest first, those of one second by when they were written', () => {
    const second = '2026-11-06T10:00:00+01:00';
    const sameSecond = changeRequestsOf(45, conversationOf(comment(9, { date: second }), comment(8, { date: second })));
    expect(stillOpen([sameSecond]).map(({ commentId }) => commentId)).toEqual([9, 8]);
  });

  it("keeps the open ones of every review read, the newest first, across reviews", () => {
    const first = changeRequestsOf(43, conversationOf(comment(1), comment(2, { appliedInChangeset: 7 })));
    const second = changeRequestsOf(44, conversationOf(comment(3), comment(4, { kind: 'discard', parentId: 3 }), comment(5)));

    expect(stillOpen([first, second]).map(({ reviewId, commentId }) => [reviewId, commentId])).toEqual([
      [44, 5],
      [43, 1],
    ]);
  });
});

describe('changeRequestNamed', () => {
  const requests = [changeRequestsOf(43, conversationOf(comment(1), comment(2)))];

  it('finds a request by the first eight digits of its guid, as cm does, or by the whole guid', () => {
    expect(changeRequestNamed(requests, 'c0d1ce02')?.commentId).toBe(2);
    expect(changeRequestNamed(requests, comment(1).guid)?.commentId).toBe(1);
  });

  it('finds none the window has not read', () => {
    expect(changeRequestNamed(requests, 'deadbeef')).toBeUndefined();
  });
});

describe('changeRequestChip', () => {
  const ago = (date: string): string => `ago ${date.slice(11, 16)}`;

  it("reads as applying the request, by its first line, its card saying where it stands, its review, who asked and when", () => {
    const [request] = changeRequestsOf(43, conversationOf(comment(1, { text: 'Shelve **first**\n\nThe undo fails.' })));

    expect(changeRequestChip(request, 'c0d1ce01', ago)).toEqual({
      lead: 'Applies',
      label: 'Shelve first',
      name: 'Applies change request: Shelve first',
      title: 'Change request c0d1ce01',
      card: { comment: 'Shelve **first**\n\nThe undo fails.', title: 'Change request c0d1ce01', meta: ['Change request c0d1ce01', 'Open', 'Code review 43', 'Ana', 'ago 10:01'] },
      opens: { reviewId: 43, threadId: 1 },
    });
  });

  it('says where an applied or a discarded one stands', () => {
    const [applied, discarded] = changeRequestsOf(43, conversationOf(comment(1, { appliedInChangeset: 7 }), comment(2), comment(3, { kind: 'discard', parentId: 2 })));

    expect(changeRequestChip(applied, 'c0d1ce01', ago).card.meta[1]).toBe('Applied in changeset 7');
    expect(changeRequestChip(discarded, 'c0d1ce02', ago).card.meta[1]).toBe('Discarded');
  });

  it('names one the window has not read by its number, opening nothing', () => {
    expect(changeRequestChip(undefined, 'deadbeef', ago)).toEqual({
      lead: 'Applies',
      label: 'change request deadbeef',
      name: 'Applies change request deadbeef',
      title: 'Change request deadbeef',
      card: { title: 'Change request deadbeef', meta: [] },
    });
  });
});

describe('branchChangeRequestsOf', () => {
  const read = <T>(data: T) => ({ data, isPending: false, isError: false });
  const reading = { data: undefined, isPending: true, isError: false };
  const failed = { data: undefined, isPending: false, isError: true };
  const reviews = read([codeReviewSummary({ id: 43, openIssueCount: 1 }), codeReviewSummary({ id: 44, openIssueCount: 1 })]);

  it("offers every read review's open requests, reading while any is read", () => {
    expect(branchChangeRequestsOf(reviews, [{ reviewId: 44, ...reading }, { reviewId: 43, ...read(conversationOf(comment(1))) }])).toMatchObject({ reading: true, failed: false, requests: [{ reviewId: 43, commentId: 1 }] });
  });

  it("keeps the other reviews' requests when one conversation couldn't be read, saying it failed", () => {
    expect(branchChangeRequestsOf(reviews, [{ reviewId: 44, ...failed }, { reviewId: 43, ...read(conversationOf(comment(1))) }])).toMatchObject({ reading: false, failed: true, requests: [{ commentId: 1 }] });
  });

  it("is reading while the branch's reviews are, and failed when they couldn't be read", () => {
    expect(branchChangeRequestsOf(reading, [])).toEqual({ requests: [], reading: true, failed: false });
    expect(branchChangeRequestsOf(failed, [])).toEqual({ requests: [], reading: false, failed: true });
  });
});

describe('changeRequestsBranch', () => {
  it("offers a check-in on a branch that branch's change requests", () => {
    expect(changeRequestsBranch({ kind: 'branch', name: '/main/task' }, 'checkin')).toBe('/main/task');
  });

  it('offers none to a shelve, which applies none, nor to a workspace on a changeset, a label or a shelve', () => {
    expect(changeRequestsBranch({ kind: 'branch', name: '/main/task' }, 'shelve')).toBeUndefined();
    expect(changeRequestsBranch({ kind: 'changeset', name: '12' }, 'checkin')).toBeUndefined();
    expect(changeRequestsBranch(undefined, 'checkin')).toBeUndefined();
  });
});

describe('notYetNamed', () => {
  const requests = changeRequestsOf(43, conversationOf(comment(1), comment(2)));

  it('leaves out the requests the comment already applies, so the count and the list follow it', () => {
    expect(notYetNamed(requests, 'Shelve first [apply-change:c0d1ce01]').map((request) => request.commentId)).toEqual([2]);
    expect(notYetNamed(requests, `[apply-change:${comment(2).guid}]`).map((request) => request.commentId)).toEqual([1]);
  });

  it('gives the same list back when the comment names none', () => {
    expect(notYetNamed(requests, 'Shelve first')).toBe(requests);
  });
});
