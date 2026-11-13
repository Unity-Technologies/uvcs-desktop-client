import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { replacedLinesIn, suggestedChangeOf, suggestionRows, suggestionTitle } from './suggestedChange';

const ON_LINE: ReviewComment['anchor'] = { kind: 'line', revisionId: 42, itemId: 7, path: '/src/Player.cs', line: 3 };
const SUGGESTING = 'Use the constant\n```suggestion\n  speed = MAX_SPEED;\n```';

describe('suggestedChangeOf', () => {
  it("reads a change request's suggestion as replacing its line of its revision", () => {
    expect(suggestedChangeOf({ kind: 'changeRequest', anchor: ON_LINE, text: SUGGESTING })).toEqual({
      path: 'src/Player.cs',
      revisionId: 42,
      firstLine: 3,
      lastLine: 3,
      lines: ['  speed = MAX_SPEED;'],
    });
  });

  it('reads none in a question, a comment or a comment on the whole review: only a change request is applied', () => {
    expect(suggestedChangeOf({ kind: 'question', anchor: ON_LINE, text: SUGGESTING })).toBeNull();
    expect(suggestedChangeOf({ kind: 'comment', anchor: ON_LINE, text: SUGGESTING })).toBeNull();
    expect(suggestedChangeOf({ kind: 'changeRequest', anchor: { kind: 'review' }, text: SUGGESTING })).toBeNull();
  });

  it('reads none in a change request without a suggestion fence', () => {
    expect(suggestedChangeOf({ kind: 'changeRequest', anchor: ON_LINE, text: '```cs\nx\n```' })).toBeNull();
  });
});

describe('replacedLinesIn', () => {
  const change = { firstLine: 2, lastLine: 2 };

  it('takes the line from the version, whatever its line ends', () => {
    expect(replacedLinesIn('a\r\nb\r\nc', change)).toEqual(['b']);
    expect(replacedLinesIn('a\nb\n', change)).toEqual(['b']);
    expect(replacedLinesIn('a\rb', change)).toEqual(['b']);
  });

  it('tells a version still read from one that failed or is shorter than the line', () => {
    expect(replacedLinesIn(undefined, change)).toBe('reading');
    expect(replacedLinesIn(null, change)).toBe('unknown');
    expect(replacedLinesIn('only one', change)).toBe('unknown');
  });
});

describe('suggestionRows', () => {
  it('shows the line removed, then the suggested lines added', () => {
    expect(suggestionRows(['old'], ['new 1', 'new 2'])).toEqual([
      { kind: 'removed', text: 'old' },
      { kind: 'added', text: 'new 1' },
      { kind: 'added', text: 'new 2' },
    ]);
  });

  it('shows a deletion as the line removed alone', () => {
    expect(suggestionRows(['old'], [])).toEqual([{ kind: 'removed', text: 'old' }]);
  });

  it("holds the removed line's place while it's read, and shows the suggested lines alone when it can't be", () => {
    expect(suggestionRows('reading', ['new'])).toEqual([{ kind: 'reading' }, { kind: 'added', text: 'new' }]);
    expect(suggestionRows('unknown', ['new'])).toEqual([{ kind: 'added', text: 'new' }]);
  });
});

describe('suggestionTitle', () => {
  it('says when the suggestion deletes the line', () => {
    expect(suggestionTitle([])).toBe('Suggested change: delete the line');
    expect(suggestionTitle(['x'])).toBe('Suggested change');
  });
});
