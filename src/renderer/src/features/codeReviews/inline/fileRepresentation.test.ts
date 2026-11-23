import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { fileCommentsOf } from './fileComments';
import type { ShownFile } from './fileThreads';
import { fileCommentsSummaryOf } from './fileRepresentation';

const ICON: ShownFile = { path: 'Art/Icon.svg', originalRevision: 10, modifiedRevision: 30 };

function onLine(id: number, revisionId: number, line: number): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'question', anchor: { kind: 'line', revisionId, itemId: 1, path: '/Art/Icon.svg', firstLine: line, lastLine: line } };
}

/** Thread 1 at line 2; thread 2 on an earlier version whose text failed to read, so outdated. */
const FILE_COMMENTS = fileCommentsOf({
  threads: threadsOf([onLine(1, 30, 2), onLine(2, 20, 1)]),
  review: { kind: 'branch', branch: '/main/task' },
  view: { kind: 'whole' },
  file: ICON,
  textOf: (revision) => (revision === 30 ? 'a\nb\n' : null),
});

const NONE: ReadonlySet<number> = new Set();

describe('fileCommentsSummaryOf', () => {
  it('counts the code\'s threads, outdated ones too, and the image\'s', () => {
    const { representation } = fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), modelThreadIds: NONE, focus: null, reviewId: 41 });
    expect(representation).toEqual({ onText: 2, onRendered: 1, asked: null });
  });

  it('asks for the view the thread gone to is on', () => {
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), modelThreadIds: NONE, focus: { threadId: 7, seq: 3 }, reviewId: 41 }).representation.asked).toEqual({ representation: 'rendered', key: '41:3' });
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), modelThreadIds: NONE, focus: { threadId: 2, seq: 4 }, reviewId: 41 }).representation.asked).toEqual({ representation: 'text', key: '41:4' });
  });

  it('asks for nothing for a thread picked in place, or of another file', () => {
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), modelThreadIds: NONE, focus: { threadId: 7, seq: 3, inPlace: true }, reviewId: 41 }).representation.asked).toBeNull();
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), modelThreadIds: NONE, focus: { threadId: 99, seq: 3 }, reviewId: 41 }).representation.asked).toBeNull();
  });

  it('shows the button that hides comments when the code or the image holds some', () => {
    const hasComments = (fileComments: typeof FILE_COMMENTS | null, ids: number[]) => fileCommentsSummaryOf({ fileComments, imageThreadIds: new Set(ids), modelThreadIds: NONE, focus: null, reviewId: 41 }).hasComments;
    expect(hasComments(FILE_COMMENTS, [])).toBe(true);
    expect(hasComments(null, [7])).toBe(true);
    expect(hasComments(FILE_COMMENTS, [7])).toBe(true);
    expect(hasComments(null, [])).toBe(false);
  });

  it("counts a 3D model's threads as what the file draws, asks for its view, and shows the button that hides comments", () => {
    const onModel = fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: NONE, modelThreadIds: new Set([8, 9]), focus: { threadId: 9, seq: 5 }, reviewId: 41 });
    expect(onModel.representation).toEqual({ onText: 2, onRendered: 2, asked: { representation: 'rendered', key: '41:5' } });
    expect(onModel.hasComments).toBe(true);
    expect(fileCommentsSummaryOf({ fileComments: null, imageThreadIds: NONE, modelThreadIds: new Set([8]), focus: null, reviewId: 41 }).hasComments).toBe(true);
  });
});
