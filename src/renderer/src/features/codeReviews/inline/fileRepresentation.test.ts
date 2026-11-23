import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { fileCommentsOf } from './fileComments';
import type { ShownFile } from './fileThreads';
import { commentsToggleLabel } from './commentsToggle';
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

describe('fileCommentsSummaryOf', () => {
  it('counts the code\'s threads, outdated ones too, and the image\'s', () => {
    const { representation } = fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), focus: null, reviewId: 41 });
    expect(representation).toEqual({ onText: 2, onImage: 1, asked: null });
  });

  it('asks for the view the thread gone to is on', () => {
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), focus: { threadId: 7, seq: 3 }, reviewId: 41 }).representation.asked).toEqual({ representation: 'image', key: '41:3' });
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), focus: { threadId: 2, seq: 4 }, reviewId: 41 }).representation.asked).toEqual({ representation: 'text', key: '41:4' });
  });

  it('asks for nothing for a thread picked in place, or of another file', () => {
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), focus: { threadId: 7, seq: 3, inPlace: true }, reviewId: 41 }).representation.asked).toBeNull();
    expect(fileCommentsSummaryOf({ fileComments: FILE_COMMENTS, imageThreadIds: new Set([7]), focus: { threadId: 99, seq: 3 }, reviewId: 41 }).representation.asked).toBeNull();
  });

  it('hides comments from where they are: the code, the image, both, or nowhere', () => {
    const hidden = (fileComments: typeof FILE_COMMENTS | null, ids: number[]) => fileCommentsSummaryOf({ fileComments, imageThreadIds: new Set(ids), focus: null, reviewId: 41 }).hidden;
    expect(hidden(FILE_COMMENTS, [])).toBe('code');
    expect(hidden(null, [7])).toBe('image');
    expect(hidden(FILE_COMMENTS, [7])).toBe('both');
    expect(hidden(null, [])).toBeNull();
  });
});

describe('commentsToggleLabel', () => {
  it('says which way it goes, and where', () => {
    expect(commentsToggleLabel(true, 'code')).toBe('Hide comments in the code');
    expect(commentsToggleLabel(false, 'image')).toBe('Show comments on the image');
    expect(commentsToggleLabel(true, 'both')).toBe('Hide comments');
  });
});
