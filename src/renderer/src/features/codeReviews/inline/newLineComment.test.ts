import { describe, expect, it } from 'vitest';
import type { ShownFile } from './fileThreads';
import { DEFAULT_LINE_COMMENT_KIND, LINE_COMMENT_KINDS, lineCommentAt, lineRowContent, newLineCommentKey, newLineCommentsIn, newLineCommentSpot, withNewLineCommentBands, withNewLineCommentRows, type NewLineCommentSpot } from './newLineComment';

const WHOLE = { kind: 'whole' } as const;
const CHANGESET_8 = { kind: 'changeset', changesetId: 8 } as const;
const CHANGED: ShownFile = { path: 'src/Player.cs', originalRevision: 10, modifiedRevision: 30 };
const ADDED: ShownFile = { path: 'src/New.cs', originalRevision: -1, modifiedRevision: 31 };
const DELETED: ShownFile = { path: 'src/Old.cs', originalRevision: 12, modifiedRevision: -1 };

const spot = (fields: Partial<NewLineCommentSpot['comment']> & { reviewId?: number; side?: NewLineCommentSpot['side']; path?: string } = {}): NewLineCommentSpot => {
  const { reviewId = 41, side = 'additions', path = CHANGED.path, kind = 'changeRequest', ...at } = fields;
  const made = newLineCommentSpot(reviewId, path, side, { revisionId: 30, line: 7, ...at });
  return { ...made, comment: { ...made.comment, kind } };
};

describe('lineCommentAt', () => {
  it("takes a line of the newer side, on the revision it shows", () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'additions', lineNumber: 42 })).toEqual({ revisionId: 30, line: 42 });
    expect(lineCommentAt(WHOLE, ADDED, { side: 'additions', lineNumber: 1 })).toEqual({ revisionId: 31, line: 1 });
  });

  it("takes no line of the older side of a changed file: cm comments only on the revision the diff shows", () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'deletions', lineNumber: 42 })).toBeNull();
  });

  it("takes a deleted file's lines, on its last revision, the one side it has", () => {
    expect(lineCommentAt(WHOLE, DELETED, { side: 'deletions', lineNumber: 3 })).toEqual({ revisionId: 12, line: 3 });
    expect(lineCommentAt(WHOLE, DELETED, { side: 'additions', lineNumber: 3 })).toBeNull();
  });

  it('takes no row above the code', () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'additions', lineNumber: 0 })).toBeNull();
  });

  it('is written in the changeset shown, changeset by changeset', () => {
    expect(lineCommentAt(CHANGESET_8, CHANGED, { side: 'additions', lineNumber: 5 })).toEqual({ revisionId: 30, line: 5, changesetId: 8 });
  });
});

describe('newLineCommentKey', () => {
  it('tells apart lines, files, modes and reviews', () => {
    const keys = [
      newLineCommentKey(41, 'src/Player.cs', { line: 7 }),
      newLineCommentKey(41, 'src/Player.cs', { line: 8 }),
      newLineCommentKey(41, 'src/Enemy.cs', { line: 7 }),
      newLineCommentKey(41, 'src/Player.cs', { line: 7, changesetId: 8 }),
      newLineCommentKey(42, 'src/Player.cs', { line: 7 }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('newLineCommentSpot', () => {
  it('starts as the default kind, a change request', () => {
    expect(spot().comment.kind).toBe(DEFAULT_LINE_COMMENT_KIND);
    expect(DEFAULT_LINE_COMMENT_KIND).toBe('changeRequest');
  });

  it('offers the default kind first, then a question and a comment', () => {
    expect(LINE_COMMENT_KINDS).toEqual(['changeRequest', 'question', 'comment']);
  });
});

describe('newLineCommentsIn', () => {
  it("keeps those of the review, on the file, in the mode shown", () => {
    const here = spot();
    const spots = [here, spot({ reviewId: 42 }), spot({ path: 'src/Enemy.cs' }), spot({ changesetId: 8 })];
    expect(newLineCommentsIn(spots, 41, WHOLE, CHANGED)).toEqual([here]);
    expect(newLineCommentsIn(spots, 41, CHANGESET_8, CHANGED)).toEqual([spots[3]]);
  });

  it("keeps a comment being written under its line once the file's newest revision changed, on the revision shown now", () => {
    const written = spot({ revisionId: 30 });
    const checkedInSince = { ...CHANGED, modifiedRevision: 35 };
    expect(newLineCommentsIn([written], 41, WHOLE, checkedInSince)).toEqual([{ ...written, comment: { ...written.comment, revisionId: 35 } }]);
  });

  it("finds a deleted file's on its older side", () => {
    const onDeleted = spot({ revisionId: 12, side: 'deletions', path: DELETED.path });
    expect(newLineCommentsIn([onDeleted], 41, WHOLE, DELETED)).toEqual([onDeleted]);
  });
});

describe('withNewLineCommentRows', () => {
  const threadsAt9 = { side: 'additions', lineNumber: 9, metadata: 'additions:9' } as const;

  it('adds a row under each line being commented on, after the rows shown', () => {
    expect(withNewLineCommentRows([threadsAt9], [spot({ line: 3 })])).toEqual([threadsAt9, { side: 'additions', lineNumber: 3, metadata: 'additions:3' }]);
  });

  it('adds none for a line already showing its threads: the new comment goes in that row', () => {
    expect(withNewLineCommentRows([threadsAt9], [spot({ line: 9 })])).toEqual([threadsAt9]);
  });
});

describe('withNewLineCommentBands', () => {
  const threadsAt9 = { key: 'additions:9', side: 'additions', lineNumber: 9, selected: false } as const;

  it('outlines the line being commented on in the accent', () => {
    expect(withNewLineCommentBands([threadsAt9], [spot({ line: 3 })])).toEqual([threadsAt9, { key: 'additions:3', side: 'additions', lineNumber: 3, selected: true }]);
  });

  it("marks a line with threads once, in the accent, while a comment is written on it", () => {
    expect(withNewLineCommentBands([threadsAt9], [spot({ line: 9 })])).toEqual([{ ...threadsAt9, selected: true }]);
  });
});

describe('lineRowContent', () => {
  const lineAt9 = { key: 'additions:9' };

  it("holds the line's threads, then the comment written there", () => {
    const written = spot({ line: 9 });
    expect(lineRowContent('additions:9', [lineAt9], [written])).toEqual({ line: lineAt9, spot: written });
  });

  it('holds only the comment written on a line whose threads are hidden', () => {
    const written = spot({ line: 9 });
    expect(lineRowContent('additions:9', [], [written])).toEqual({ line: undefined, spot: written });
  });

  it('holds nothing for a row of neither', () => {
    expect(lineRowContent('additions:4', [lineAt9], [spot({ line: 9 })])).toEqual({ line: undefined, spot: undefined });
  });
});
