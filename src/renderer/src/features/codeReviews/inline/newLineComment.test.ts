import { describe, expect, it } from 'vitest';
import type { ShownFile } from './fileThreads';
import { DEFAULT_LINE_COMMENT_KIND, crossesCommentBeingWritten, focusOnRequest, LINE_COMMENT_KINDS, lineCommentAt, lineCommentLabel, lineRowContent, newLineCommentKey, newLineCommentsIn, newLineCommentSpot, openedSpotRow, withNewLineCommentBands, withNewLineCommentRows, type NewLineCommentSpot } from './newLineComment';

const WHOLE = { kind: 'whole' } as const;
const CHANGESET_8 = { kind: 'changeset', changesetId: 8 } as const;
const CHANGED: ShownFile = { path: 'src/Player.cs', originalRevision: 10, modifiedRevision: 30 };
const ADDED: ShownFile = { path: 'src/New.cs', originalRevision: -1, modifiedRevision: 31 };
const DELETED: ShownFile = { path: 'src/Old.cs', originalRevision: 12, modifiedRevision: -1 };

const spot = (fields: Partial<NewLineCommentSpot['comment']> & { reviewId?: number; side?: NewLineCommentSpot['side']; path?: string } = {}): NewLineCommentSpot => {
  const { reviewId = 41, side = 'additions', path = CHANGED.path, kind = 'changeRequest', ...at } = fields;
  const made = newLineCommentSpot(reviewId, path, side, { revisionId: 30, firstLine: 7, lastLine: 7, ...at });
  return { ...made, comment: { ...made.comment, kind } };
};

describe('lineCommentAt', () => {
  it("takes a line of the newer side, on the revision it shows", () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'additions', firstLineNumber: 42, lineNumber: 42 })).toEqual({ revisionId: 30, firstLine: 42, lastLine: 42 });
    expect(lineCommentAt(WHOLE, ADDED, { side: 'additions', firstLineNumber: 1, lineNumber: 1 })).toEqual({ revisionId: 31, firstLine: 1, lastLine: 1 });
  });

  it("takes no line of the older side of a changed file: cm comments only on the revision the diff shows", () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'deletions', firstLineNumber: 42, lineNumber: 42 })).toBeNull();
  });

  it("takes a deleted file's lines, on its last revision, the one side it has", () => {
    expect(lineCommentAt(WHOLE, DELETED, { side: 'deletions', firstLineNumber: 3, lineNumber: 3 })).toEqual({ revisionId: 12, firstLine: 3, lastLine: 3 });
    expect(lineCommentAt(WHOLE, DELETED, { side: 'additions', firstLineNumber: 3, lineNumber: 3 })).toBeNull();
  });

  it('takes no row above the code', () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'additions', firstLineNumber: 0, lineNumber: 0 })).toBeNull();
  });

  it('takes the lines selected on the side it comments on', () => {
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'additions', firstLineNumber: 12, lineNumber: 18 })).toEqual({ revisionId: 30, firstLine: 12, lastLine: 18 });
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'deletions', firstLineNumber: 12, lineNumber: 18 })).toBeNull();
    expect(lineCommentAt(WHOLE, CHANGED, { side: 'additions', firstLineNumber: 18, lineNumber: 12 })).toBeNull();
  });

  it("is written in the changeset shown, one of the branch's", () => {
    expect(lineCommentAt(CHANGESET_8, CHANGED, { side: 'additions', firstLineNumber: 5, lineNumber: 5 })).toEqual({ revisionId: 30, firstLine: 5, lastLine: 5, changesetId: 8 });
  });
});

describe('newLineCommentKey', () => {
  it('tells apart lines, files, modes and reviews', () => {
    const keys = [
      newLineCommentKey(41, 'src/Player.cs', { firstLine: 7, lastLine: 7 }),
      newLineCommentKey(41, 'src/Player.cs', { firstLine: 8, lastLine: 8 }),
      newLineCommentKey(41, 'src/Enemy.cs', { firstLine: 7, lastLine: 7 }),
      newLineCommentKey(41, 'src/Player.cs', { firstLine: 7, lastLine: 7, changesetId: 8 }),
      newLineCommentKey(42, 'src/Player.cs', { firstLine: 7, lastLine: 7 }),
      newLineCommentKey(41, 'src/Player.cs', { firstLine: 7, lastLine: 9 }),
      newLineCommentKey(41, 'src/Player.cs', { firstLine: 5, lastLine: 9 }),
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

  it("keeps a comment being written on a file deleted since, on its last revision, the one side it has", () => {
    const written = spot({ revisionId: 30, path: 'src/Player.cs' });
    const deletedSince: ShownFile = { path: 'src/Player.cs', originalRevision: 30, modifiedRevision: -1 };
    expect(newLineCommentsIn([written], 41, WHOLE, deletedSince)).toEqual([{ ...written, side: 'deletions', comment: { ...written.comment, revisionId: 30 } }]);
  });

  it("finds a deleted file's on its older side", () => {
    const onDeleted = spot({ revisionId: 12, side: 'deletions', path: DELETED.path });
    expect(newLineCommentsIn([onDeleted], 41, WHOLE, DELETED)).toEqual([onDeleted]);
  });
});

describe('withNewLineCommentRows', () => {
  const threadsAt9 = { side: 'additions', lineNumber: 9, metadata: 'additions:9' } as const;

  it('adds a row under each line being commented on, after the rows shown', () => {
    expect(withNewLineCommentRows([threadsAt9], [spot({ firstLine: 3, lastLine: 3 })])).toEqual([threadsAt9, { side: 'additions', lineNumber: 3, metadata: 'additions:3' }]);
  });

  it('adds the row of a range under its last line', () => {
    expect(withNewLineCommentRows([], [spot({ firstLine: 3, lastLine: 6 })])).toEqual([{ side: 'additions', lineNumber: 6, metadata: 'additions:6' }]);
  });

  it('adds one row for comments being written that end on the same line', () => {
    expect(withNewLineCommentRows([], [spot({ firstLine: 9, lastLine: 9 }), spot({ firstLine: 5, lastLine: 9 })])).toEqual([{ side: 'additions', lineNumber: 9, metadata: 'additions:9' }]);
  });

  it('adds none for a line already showing its threads: the new comment goes in that row', () => {
    expect(withNewLineCommentRows([threadsAt9], [spot({ firstLine: 9, lastLine: 9 })])).toEqual([threadsAt9]);
  });
});

describe('withNewLineCommentBands', () => {
  const threadsAt9 = { key: 'additions:9', side: 'additions', lineNumber: 9, selected: false } as const;

  it('outlines the line being commented on in the accent', () => {
    expect(withNewLineCommentBands([threadsAt9], [spot({ firstLine: 3, lastLine: 3 })])).toEqual([threadsAt9, { key: 'additions:3', side: 'additions', lineNumber: 3, selected: true }]);
  });

  it("marks a line with threads once, in the accent, while a comment is written on it", () => {
    expect(withNewLineCommentBands([threadsAt9], [spot({ firstLine: 9, lastLine: 9 })])).toEqual([{ ...threadsAt9, selected: true }]);
  });

  it('outlines once, from the first of them, comments being written that end on the same line', () => {
    expect(withNewLineCommentBands([], [spot({ firstLine: 9, lastLine: 9 }), spot({ firstLine: 5, lastLine: 9 })])).toEqual([{ key: 'additions:9', side: 'additions', lineNumber: 9, firstLineNumber: 5, selected: true }]);
  });

  it('outlines a range being commented on from its first line, a line with threads too', () => {
    expect(withNewLineCommentBands([], [spot({ firstLine: 3, lastLine: 6 })])).toEqual([{ key: 'additions:6', side: 'additions', lineNumber: 6, firstLineNumber: 3, selected: true }]);
    expect(withNewLineCommentBands([threadsAt9], [spot({ firstLine: 5, lastLine: 9 })])).toEqual([{ ...threadsAt9, firstLineNumber: 5, selected: true }]);
  });
});

describe('lineRowContent', () => {
  const lineAt9 = { key: 'additions:9' };

  it("holds the line's threads, then the comment written there", () => {
    const written = spot({ firstLine: 9, lastLine: 9 });
    expect(lineRowContent('additions:9', [lineAt9], [written])).toEqual({ line: lineAt9, spots: [written] });
  });

  it('holds every comment being written that ends on its line, in the order they were opened', () => {
    const onLine = spot({ firstLine: 9, lastLine: 9 });
    const onRange = spot({ firstLine: 5, lastLine: 9 });
    expect(lineRowContent('additions:9', [], [onLine, onRange])).toEqual({ line: undefined, spots: [onLine, onRange] });
  });

  it('holds only the comment written on a line whose threads are hidden', () => {
    const written = spot({ firstLine: 9, lastLine: 9 });
    expect(lineRowContent('additions:9', [], [written])).toEqual({ line: undefined, spots: [written] });
  });

  it('holds a range being commented on in its last line\'s row', () => {
    const written = spot({ firstLine: 5, lastLine: 9 });
    expect(lineRowContent('additions:9', [lineAt9], [written])).toEqual({ line: lineAt9, spots: [written] });
  });

  it('holds nothing for a row of neither', () => {
    expect(lineRowContent('additions:4', [lineAt9], [spot({ firstLine: 9, lastLine: 9 })])).toEqual({ line: undefined, spots: [] });
  });
});

describe('focusOnRequest', () => {
  it('opened just now: its field took the focus as it mounted', () => {
    expect(focusOnRequest(1, 1)).toBe('taken');
  });

  it('kept, then shown again with its file: takes nothing from where the user is', () => {
    expect(focusOnRequest(null, null)).toBe('none');
  });

  it('its "+" pressed again while it shows: takes the focus now', () => {
    expect(focusOnRequest(1, 2)).toBe('focus');
    expect(focusOnRequest(null, 3)).toBe('focus');
  });

  it('asked once, answered once: after the request is taken, running again does nothing (StrictMode)', () => {
    expect(focusOnRequest(1, null)).toBe('none');
  });
});

describe('lineCommentLabel', () => {
  it('names the line, or the lines selected', () => {
    expect(lineCommentLabel({ side: 'additions', firstLineNumber: 42, lineNumber: 42 })).toBe('Comment on line 42');
    expect(lineCommentLabel({ side: 'additions', firstLineNumber: 40, lineNumber: 42 })).toBe('Comment on lines 40–42');
  });
});

describe('crossesCommentBeingWritten', () => {
  const writing = [spot({ firstLine: 10, lastLine: 20 })];
  const at = (firstLine: number, lastLine: number) => ({ revisionId: 30, firstLine, lastLine });

  it('refuses lines inside, or across, a comment being written on other lines', () => {
    expect(crossesCommentBeingWritten(writing, at(12, 12))).toBe(true);
    expect(crossesCommentBeingWritten(writing, at(5, 10))).toBe(true);
    expect(crossesCommentBeingWritten(writing, at(18, 25))).toBe(true);
    expect(crossesCommentBeingWritten(writing, at(5, 25))).toBe(true);
  });

  it('takes the same lines, which go back to the comment being written, and lines beside it', () => {
    expect(crossesCommentBeingWritten(writing, at(10, 20))).toBe(false);
    expect(crossesCommentBeingWritten(writing, at(9, 9))).toBe(false);
    expect(crossesCommentBeingWritten(writing, at(21, 30))).toBe(false);
    expect(crossesCommentBeingWritten([], at(12, 12))).toBe(false);
  });
});

describe('openedSpotRow', () => {
  const range = spot({ firstLine: 24, lastLine: 152 });
  const other = spot({ path: 'src/Enemy.cs' });

  it("is the row under the last line of the comment just opened here, once per request", () => {
    expect(openedSpotRow([range], { key: range.key, seq: 3 })).toEqual({ seq: 3, side: 'additions', lineNumber: 152 });
  });

  it("is none when no comment was just opened, or the one opened is another file's", () => {
    expect(openedSpotRow([range], null)).toBeNull();
    expect(openedSpotRow([range], { key: other.key, seq: 3 })).toBeNull();
  });
});
