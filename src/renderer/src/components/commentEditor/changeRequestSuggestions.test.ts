import { describe, expect, it } from 'vitest';
import type { ReviewChangeRequest } from '../../features/codeReviews/changeRequests/changeRequests';
import { findReferences } from '../../lib/comments/commentReferences';
import { changeRequestIndex, changeRequestSuggestions } from './changeRequestSuggestions';

function request(commentId: number, text: string, fields: Partial<ReviewChangeRequest> = {}): ReviewChangeRequest {
  return {
    reviewId: 43,
    commentId,
    guid: `c0d1ce${String(commentId).padStart(2, '0')}-b457-4424-99ff-a3f1c0fa2582`,
    author: 'ana',
    date: '2026-11-06T10:00:00+01:00',
    text,
    location: { path: '/Assets/Scripts/SwitchFlow.cs', lines: { firstLine: 11, lastLine: 11 } },
    state: { kind: 'open' },
    ...fields,
  };
}

const REQUESTS = [request(1, 'Undo before shelving fails: **shelve** first.'), request(2, 'Log the shelve number here.', { location: undefined, reviewId: 44, author: 'bob' })];

describe('changeRequestSuggestions', () => {
  it("offers each request by its first line, where it was written and its review, who asked, and writes cm's reference", () => {
    expect(changeRequestSuggestions(changeRequestIndex(REQUESTS), '')).toEqual([
      { key: 'apply:c0d1ce01-b457-4424-99ff-a3f1c0fa2582', kind: 'changeRequest', label: 'Undo before shelving fails: shelve first.', detail: 'SwitchFlow.cs:11 · cr:43', owner: 'ana', insert: '[apply-change:c0d1ce01]', tip: { text: 'Change request c0d1ce01', sub: 'Undo before shelving fails: shelve first.' } },
      { key: 'apply:c0d1ce02-b457-4424-99ff-a3f1c0fa2582', kind: 'changeRequest', label: 'Log the shelve number here.', detail: 'cr:44', owner: 'bob', insert: '[apply-change:c0d1ce02]', tip: { text: 'Change request c0d1ce02', sub: 'Log the shelve number here.' } },
    ]);
  });

  it('names a request in its tooltip by the number a check-in comment applies it by, over its whole first line, which the row cuts', () => {
    const long = request(5, `${'Move the camera behind the player when the level starts, '.repeat(2)}not above.\n\nThe intro looks odd.`);
    const [suggestion] = changeRequestSuggestions(changeRequestIndex([long]), '');
    expect(suggestion?.label.endsWith('…')).toBe(true);
    expect(suggestion?.tip).toEqual({ text: 'Change request c0d1ce05', sub: `${'Move the camera behind the player when the level starts, '.repeat(2)}not above.` });
  });

  it('names a request on a range of lines by its first and last line', () => {
    const range = request(3, 'Extract these.', { location: { path: '/src/Player.cs', lines: { firstLine: 12, lastLine: 18 } } });
    expect(changeRequestSuggestions(changeRequestIndex([range]), '')[0]?.detail).toBe('Player.cs:12-18 · cr:43');
  });

  it('names a request on an image by its file alone, and finds it by it', () => {
    const onImage = request(4, 'Crop the sun.', { location: { path: '/Art/Banner.png' } });
    expect(changeRequestSuggestions(changeRequestIndex([onImage]), '')[0]?.detail).toBe('Banner.png · cr:43');
    expect(changeRequestSuggestions(changeRequestIndex([onImage]), 'banner')).toHaveLength(1);
  });

  it("filters by the request's words, its file, who asked or its number", () => {
    const index = changeRequestIndex(REQUESTS);
    expect(changeRequestSuggestions(index, 'number').map((suggestion) => suggestion.insert)).toEqual(['[apply-change:c0d1ce02]']);
    expect(changeRequestSuggestions(index, 'switchflow').map((suggestion) => suggestion.insert)).toEqual(['[apply-change:c0d1ce01]']);
    expect(changeRequestSuggestions(index, 'bob').map((suggestion) => suggestion.insert)).toEqual(['[apply-change:c0d1ce02]']);
    expect(changeRequestSuggestions(index, 'c0d1ce01').map((suggestion) => suggestion.insert)).toEqual(['[apply-change:c0d1ce01]']);
  });

  it('writes what a comment reads back as the request', () => {
    const [suggestion] = changeRequestSuggestions(changeRequestIndex(REQUESTS), '');
    expect(findReferences(suggestion!.insert).map((found) => found.reference)).toEqual([{ kind: 'changeRequest', guid: 'c0d1ce01' }]);
  });
});
