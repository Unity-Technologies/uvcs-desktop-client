import { describe, expect, it } from 'vitest';
import { historyLineLinks, historyPlace } from './historyLineLinks';

const FOCUS = { path: 'a.cs', lines: { side: 'new', first: 3, last: 3 } } as const;
const shown = (view: 'history' | 'annotate') => ({ path: 'a.cs', changesetId: 7, view, otherRepository: false });

describe('historyLineLinks', () => {
  it("shows a link's lines and publishes the lines selected only annotated, where a history's link names lines", () => {
    expect(historyLineLinks(FOCUS, shown('annotate'))).toEqual({ focus: FOCUS, publishes: true });
    expect(historyLineLinks(FOCUS, shown('history'))).toEqual({ focus: null, publishes: false });
    expect(historyLineLinks(FOCUS, null).focus).toBeNull();
  });
});

describe('historyPlace', () => {
  it('is the revision and its view, so selecting another or switching the view moves away', () => {
    expect(historyPlace(shown('annotate'))).toBe('7:annotate');
    expect(historyPlace(shown('history'))).not.toBe(historyPlace(shown('annotate')));
    expect(historyPlace(null)).toBeUndefined();
  });
});
