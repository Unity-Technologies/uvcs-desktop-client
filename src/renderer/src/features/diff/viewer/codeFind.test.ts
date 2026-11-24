import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import {
  findBarKeyAction,
  findBarRight,
  findInText,
  findOpening,
  firstMatchFrom,
  matchCountWords,
  matchMarks,
  rowNeedsScroll,
  shownMatchMarks,
  sidewaysScrollBy,
  sideToFind,
  steppedMatch,
  type FindOptions,
} from './codeFind';

const ANY_CASE: FindOptions = { matchCase: false, wholeWord: false, regex: false };

describe('findInText', () => {
  it('finds nothing before a query', () => {
    expect(findInText('player', '', ANY_CASE)).toEqual({ matches: [], capped: false });
  });

  it('finds every match in the order of the text, by line and characters', () => {
    expect(findInText('let speed = 1;\nspeed += speed;', 'speed', ANY_CASE).matches).toEqual([
      { line: 1, start: 4, end: 9 },
      { line: 2, start: 0, end: 5 },
      { line: 2, start: 9, end: 14 },
    ]);
  });

  it('breaks lines on LF, CRLF and lone CRs, as Pierre shows them', () => {
    expect(findInText('a\r\nb a\ra', 'a', ANY_CASE).matches.map((match) => match.line)).toEqual([1, 2, 3]);
  });

  it('ignores case unless asked to match it', () => {
    const text = 'Player player PLAYER';
    expect(findInText(text, 'player', ANY_CASE).matches).toHaveLength(3);
    expect(findInText(text, 'player', { matchCase: true, wholeWord: false, regex: false }).matches).toEqual([{ line: 1, start: 7, end: 13 }]);
  });

  it('folds letters beyond ASCII one for one, keeping each match its length', () => {
    expect(findInText('ΣΟΦΙΑ σοφια', 'σοφια', ANY_CASE).matches).toEqual([
      { line: 1, start: 0, end: 5 },
      { line: 1, start: 6, end: 11 },
    ]);
  });

  it('takes the query as text, never a pattern', () => {
    expect(findInText('a.b axb (x)', 'a.b', ANY_CASE).matches).toEqual([{ line: 1, start: 0, end: 3 }]);
    expect(findInText('a.b axb (x)', '(x)', ANY_CASE).matches).toEqual([{ line: 1, start: 8, end: 11 }]);
  });

  it('finds whole words only when asked, letters, digits and underscores making a word', () => {
    const wholeWord = { matchCase: false, wholeWord: true, regex: false };
    expect(findInText('id ids _id id2 (id) día', 'id', wholeWord).matches).toEqual([
      { line: 1, start: 0, end: 2 },
      { line: 1, start: 16, end: 18 },
    ]);
    expect(findInText('ñame', 'ame', wholeWord).matches).toEqual([]);
  });

  it('takes the query as a regular expression when asked, whole words and case as for text', () => {
    const regex = { matchCase: false, wholeWord: false, regex: true };
    expect(findInText('speed = 12f; turn = 200f;', '\\d+f', regex).matches).toEqual([
      { line: 1, start: 8, end: 11 },
      { line: 1, start: 20, end: 24 },
    ]);
    expect(findInText('a|b ab', 'a|b', { ...regex, wholeWord: true }).matches).toEqual([
      { line: 1, start: 0, end: 1 },
      { line: 1, start: 2, end: 3 },
    ]);
  });

  it('finds nothing for a regular expression that does not compile yet, and skips empty matches', () => {
    const regex = { matchCase: false, wholeWord: false, regex: true };
    expect(findInText('(a|b)', '(a|', regex)).toEqual({ matches: [], capped: false });
    expect(findInText('baab', 'a*', regex).matches).toEqual([{ line: 1, start: 1, end: 3 }]);
    expect(findInText('one\ntwo', '^', regex).matches).toEqual([]);
  });

  it('counts characters as the page does: an emoji is two', () => {
    expect(findInText('😀 hit', 'hit', ANY_CASE).matches).toEqual([{ line: 1, start: 3, end: 6 }]);
  });

  it('keeps no more matches than its limit, and says there were more', () => {
    expect(findInText('aaaa', 'a', ANY_CASE, 3)).toEqual({ matches: [{ line: 1, start: 0, end: 1 }, { line: 1, start: 1, end: 2 }, { line: 1, start: 2, end: 3 }], capped: true });
    expect(findInText('aaa', 'a', ANY_CASE, 3).capped).toBe(false);
  });

  it('keeps, past its limit, the matches from the line searched from, going round from the top', () => {
    const text = ['hit', 'hit', 'hit', 'hit', 'hit'].join('\n');
    expect(findInText(text, 'hit', ANY_CASE, 3, 4).matches.map((match) => match.line)).toEqual([1, 4, 5]);
    expect(findInText(text, 'hit', ANY_CASE, 10, 4).matches.map((match) => match.line)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('firstMatchFrom', () => {
  const matches = [
    { line: 2, start: 4, end: 6 },
    { line: 5, start: 0, end: 2 },
  ];

  it('starts at the first match at or after where the user was', () => {
    expect(firstMatchFrom(matches, { line: 2, character: 4 })).toBe(0);
    expect(firstMatchFrom(matches, { line: 2, character: 5 })).toBe(1);
    expect(firstMatchFrom(matches, { line: 3, character: 0 })).toBe(1);
  });

  it('goes round to the first past the last, and starts there from nowhere', () => {
    expect(firstMatchFrom(matches, { line: 9, character: 0 })).toBe(0);
    expect(firstMatchFrom(matches, null)).toBe(0);
  });

  it('has none without matches', () => {
    expect(firstMatchFrom([], { line: 1, character: 0 })).toBeNull();
  });
});

describe('steppedMatch', () => {
  it('steps forward and back, going round at either end', () => {
    expect(steppedMatch(3, 0, false)).toBe(1);
    expect(steppedMatch(3, 2, false)).toBe(0);
    expect(steppedMatch(3, 0, true)).toBe(2);
  });

  it('starts at either end from no match, and has none without matches', () => {
    expect(steppedMatch(3, null, false)).toBe(0);
    expect(steppedMatch(3, null, true)).toBe(2);
    expect(steppedMatch(0, null, false)).toBeNull();
  });
});

describe('matchCountWords', () => {
  const found = (count: number, capped = false) => ({ matches: Array.from({ length: count }, () => ({ line: 1, start: 0, end: 1 })), capped });

  it('says nothing before a query, and that nothing matched after one', () => {
    expect(matchCountWords('', null, found(0))).toBe('');
    expect(matchCountWords('x', null, found(0))).toBe('No results');
  });

  it('says which match shows of how many', () => {
    expect(matchCountWords('x', 2, found(12))).toBe('3 of 12');
  });

  it('says there are more past the limit', () => {
    expect(matchCountWords('x', 0, found(10_000, true))).toBe('1 of 10,000+');
  });
});

describe('matchMarks', () => {
  it('marks every match on the side searched, by line', () => {
    const matches = [
      { line: 3, start: 0, end: 2 },
      { line: 3, start: 5, end: 7 },
      { line: 8, start: 1, end: 3 },
    ];
    expect(matchMarks('deletions', matches)).toEqual({
      deletions: new Map([
        [3, [{ start: 0, end: 2 }, { start: 5, end: 7 }]],
        [8, [{ start: 1, end: 3 }]],
      ]),
      additions: new Map(),
    });
  });

  it('marks thousands of matches on one minified line in one list', () => {
    const marks = matchMarks('additions', findInText('a;'.repeat(5_000), ';', ANY_CASE).matches);
    expect(marks.additions.get(1)).toHaveLength(5_000);
  });

  it('marks the match shown on its own, or nothing without one', () => {
    expect(shownMatchMarks('additions', { line: 4, start: 2, end: 5 })).toEqual({ deletions: new Map(), additions: new Map([[4, [{ start: 2, end: 5 }]]]) });
    expect(shownMatchMarks('deletions', null)).toEqual({ deletions: new Map(), additions: new Map() });
  });
});

describe('findOpening', () => {
  const pressedOld = { side: 'deletions' as const, lineNumber: 12 };

  it('opens the bar on the read-only side pressed, from the line pressed', () => {
    expect(findOpening(null, true, pressedOld)).toEqual({ kind: 'bar', side: 'deletions', from: { line: 12, character: 0 } });
  });

  it("leaves the side typed into to its editor's search panel, so one side never has two", () => {
    expect(findOpening(null, true, { side: 'additions', lineNumber: 3 })).toEqual({ kind: 'editor' });
    expect(findOpening(null, true, null)).toEqual({ kind: 'editor' });
    expect(findOpening('additions', true, null)).toEqual({ kind: 'editor' });
  });

  it('opens the bar on a newer side nothing types into', () => {
    expect(findOpening(null, false, { side: 'additions', lineNumber: 3 })).toEqual({ kind: 'bar', side: 'additions', from: { line: 3, character: 0 } });
  });

  it('searches from the top of the side right-clicked when the line pressed was on the other side', () => {
    expect(findOpening(null, false, pressedOld, 'additions')).toEqual({ kind: 'bar', side: 'additions', from: null });
  });

  it('searches the one side a diff shows alone, whichever was pressed', () => {
    expect(findOpening('deletions', false, { side: 'additions', lineNumber: 2 })).toEqual({ kind: 'bar', side: 'deletions', from: null });
  });
});

describe('findBarKeyAction', () => {
  const press = (key: string, modifiers: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  });

  it('closes with Esc and steps with Enter and Shift+Enter', () => {
    expect(findBarKeyAction(press('Escape'), true)).toBe('close');
    expect(findBarKeyAction(press('Enter'), true)).toBe('next');
    expect(findBarKeyAction(press('Enter', { shiftKey: true }), true)).toBe('previous');
  });

  it("takes ⌘F (Ctrl+F off macOS) to select its text again, so it never reaches the view's filter", () => {
    expect(findBarKeyAction(press('f', { metaKey: true }), true)).toBe('reselect');
    expect(findBarKeyAction(press('f', { ctrlKey: true }), false)).toBe('reselect');
  });

  it('leaves every other key to the field', () => {
    expect(findBarKeyAction(press('f'), true)).toBeNull();
    expect(findBarKeyAction(press('a', { metaKey: true }), true)).toBeNull();
  });
});

describe('sideToFind', () => {
  it('searches the one side a diff shows alone', () => {
    expect(sideToFind('deletions', 'additions')).toBe('deletions');
  });

  it('searches the side pressed last, else the newer one', () => {
    expect(sideToFind(null, 'deletions')).toBe('deletions');
    expect(sideToFind(null, null)).toBe('additions');
  });
});

describe('rowNeedsScroll', () => {
  const view = { start: 100, end: 500 };

  it('leaves a row wholly in view where it is', () => {
    expect(rowNeedsScroll({ start: 100, end: 120 }, view)).toBe(false);
  });

  it('scrolls to a row partly out of view, or not drawn yet', () => {
    expect(rowNeedsScroll({ start: 90, end: 110 }, view)).toBe(true);
    expect(rowNeedsScroll({ start: 490, end: 510 }, view)).toBe(true);
    expect(rowNeedsScroll(null, view)).toBe(true);
  });
});

describe('sidewaysScrollBy', () => {
  const shown = { start: 60, end: 660 };

  it('leaves characters already shown where they are', () => {
    expect(sidewaysScrollBy({ start: 60, end: 100 }, shown)).toBe(0);
  });

  it('puts characters out of view a third of the way across the code', () => {
    expect(sidewaysScrollBy({ start: 1000, end: 1040 }, shown)).toBe(740);
    expect(sidewaysScrollBy({ start: 20, end: 60 }, shown)).toBe(-240);
  });
});

describe('findBarRight', () => {
  it("stands the bar at the top right of the side's own pane", () => {
    expect(findBarRight({ start: 0, end: 600 }, { start: 0, end: 1200 })).toBe(616);
    expect(findBarRight({ start: 600, end: 1190 }, { start: 0, end: 1200 })).toBe(26);
  });

  it("leaves it at the diff's top right where the side has no pane of its own", () => {
    expect(findBarRight(null, { start: 0, end: 1200 })).toBeNull();
  });
});
