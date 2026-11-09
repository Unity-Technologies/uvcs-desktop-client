import { beforeEach, describe, expect, it } from 'vitest';
import { useNavigation } from '../../../app/navigation/navigationStore';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread } from './fileThreads';
import { conversationAt, fileDiffRequest, showInConversation, threadDiffRequest } from './reviewComments';

function thread(fields: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = {
    id: 1,
    guid: 'g1',
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: 'Text',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Player.cs', line: 4 },
    ...fields,
  };
  return threadsOf([root])[0] as LineThread;
}

const review = (target: CodeReviewTarget) => ({ target });

describe('threadDiffRequest', () => {
  it("asks a branch review's diff for the file in the whole branch", () => {
    expect(threadDiffRequest(review({ kind: 'branch', branch: '/main/task' }), thread(), 3)).toEqual({ path: 'src/Player.cs', changesetId: null, seq: 3 });
  });

  it('asks for the changeset a comment was written in, changeset by changeset', () => {
    expect(threadDiffRequest(review({ kind: 'branch', branch: '/main/task' }), thread({ changesetId: 12 }), 4)).toEqual({ path: 'src/Player.cs', changesetId: 12, seq: 4 });
  });

  it('leaves the mode alone in a review with one: a changeset, a shelve', () => {
    expect(threadDiffRequest(review({ kind: 'changeset', changesetId: 12 }), thread({ changesetId: 12 }), 5)).toEqual({ path: 'src/Player.cs', seq: 5 });
    expect(threadDiffRequest(review({ kind: 'shelve', shelveId: 2 }), thread(), 6)).toEqual({ path: 'src/Player.cs', seq: 6 });
  });
});

describe('fileDiffRequest', () => {
  it("shows a file in a branch review's whole branch, which holds every file, whatever changeset is stepped to", () => {
    expect(fileDiffRequest(review({ kind: 'branch', branch: '/main/task' }), 'src/Player.cs', 3)).toEqual({ path: 'src/Player.cs', changesetId: null, seq: 3 });
  });

  it('leaves the mode alone in a review with one: a changeset, a shelve', () => {
    expect(fileDiffRequest(review({ kind: 'changeset', changesetId: 12 }), 'src/Player.cs', 4)).toEqual({ path: 'src/Player.cs', seq: 4 });
    expect(fileDiffRequest(review({ kind: 'shelve', shelveId: 2 }), 'src/Player.cs', 5)).toEqual({ path: 'src/Player.cs', seq: 5 });
  });
});

describe('showInConversation', () => {
  beforeEach(() => useNavigation.setState({ view: 'codeReviews', pages: [] }));

  it("moves the review's page to its conversation at the thread, in place: Back leaves the review", () => {
    const changes = { kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'src/Player.cs', focusThread: 7 } as const;
    useNavigation.setState({ pages: [{ kind: 'codeReview', reviewId: 40 }, changes] });

    showInConversation(41, 7);

    expect(useNavigation.getState().pages).toEqual([{ kind: 'codeReview', reviewId: 40 }, conversationAt(41, 7)]);
  });
});
