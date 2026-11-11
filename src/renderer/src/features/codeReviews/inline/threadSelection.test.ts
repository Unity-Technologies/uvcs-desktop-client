import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread, PlacedThread, ThreadSide } from './fileThreads';
import { lineThreadsOf } from './threadRows';
import { cardFocusOf, lineBandsOf, scrollsToFocus, selectedInPlace, threadOpenedFrom } from './threadSelection';

function thread(id: number): LineThread {
  const root: ReviewComment = {
    id,
    guid: `g${id}`,
    author: 'ana',
    date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`,
    text: 'Text',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Player.cs', line: 1 },
  };
  return threadsOf([root])[0] as LineThread;
}

const at = (side: ThreadSide, line: number, entry: LineThread): PlacedThread => ({ thread: entry, side, line });

describe('selectedInPlace', () => {
  it('selects a thread where it shows, without scrolling to it', () => {
    const focus = selectedInPlace(null, 7, 3);
    expect(focus).toEqual({ threadId: 7, seq: 3, inPlace: true });
    expect(scrollsToFocus(focus)).toBe(false);
  });

  it('moves the selection from the thread gone to before', () => {
    expect(selectedInPlace({ threadId: 1, seq: 2 }, 7, 3)).toEqual({ threadId: 7, seq: 3, inPlace: true });
  });

  it('keeps the thread already selected as it was, so clicking it again lights nothing and moves no list', () => {
    const goneTo = { threadId: 7, seq: 2 };
    expect(selectedInPlace(goneTo, 7, 3)).toBe(goneTo);
  });
});

describe('scrollsToFocus', () => {
  it('scrolls to a thread gone to (the panel, the keys, the conversation)', () => {
    expect(scrollsToFocus({ threadId: 7, seq: 2 })).toBe(true);
  });

  it('scrolls nowhere without a thread', () => {
    expect(scrollsToFocus(null)).toBe(false);
  });
});

describe('cardFocusOf', () => {
  it('unfolds and lights a card gone to, the how-many-th time', () => {
    expect(cardFocusOf({ threadId: 7, seq: 4 }, 7)).toEqual({ highlight: 4, selected: true });
  });

  it('only rings a card selected where it shows, leaving its fold to the user', () => {
    expect(cardFocusOf({ threadId: 7, seq: 4, inPlace: true }, 7)).toEqual({ selected: true });
  });

  it('leaves the other cards as they are', () => {
    expect(cardFocusOf({ threadId: 7, seq: 4 }, 8)).toEqual({ selected: false });
    expect(cardFocusOf(null, 8)).toEqual({ selected: false });
  });
});

describe('lineBandsOf', () => {
  const lines = lineThreadsOf([at('deletions', 4, thread(1)), at('additions', 9, thread(2)), at('additions', 9, thread(3))]);

  it('outlines every line with threads, on its side', () => {
    expect(lineBandsOf(lines, null)).toEqual([
      { key: 'deletions:4', side: 'deletions', lineNumber: 4, selected: false },
      { key: 'additions:9', side: 'additions', lineNumber: 9, selected: false },
    ]);
  });

  it('selects the line holding the focused thread, whichever of its threads it is', () => {
    expect(lineBandsOf(lines, { threadId: 3, seq: 1, inPlace: true }).map((band) => band.selected)).toEqual([false, true]);
  });

  it('selects no line for a thread the file shows at no line (an outdated one)', () => {
    expect(lineBandsOf(lines, { threadId: 99, seq: 1 }).map((band) => band.selected)).toEqual([false, false]);
  });

  it('outlines nothing in a file without threads', () => {
    expect(lineBandsOf([], null)).toEqual([]);
  });
});

describe('threadOpenedFrom', () => {
  it('selects the oldest thread of a line opened from its marker, the one its row shows first', () => {
    const [line] = lineThreadsOf([at('additions', 9, thread(5)), at('additions', 9, thread(2))]);
    expect(threadOpenedFrom(line).root.id).toBe(2);
  });
});
