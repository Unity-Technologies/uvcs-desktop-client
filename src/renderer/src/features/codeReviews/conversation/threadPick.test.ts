import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { cardLightOf, commentElementId, nextAnswerLight, openItemsOf, pickedElementId, pickedScrollOf, pickOnFocus, pickThread, threadElementId, threadMarkOf } from './threadPick';
import { openThreads, threadsOf } from './reviewThreads';
import { conversationFocus, pageAfterOpenPick } from '../reviewTab';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00+01:00`, text: `Comment ${id}`, kind: 'question', anchor: { kind: 'review' }, ...fields };
}

describe('pickThread', () => {
  it('makes the thread picked in Open the current one', () => {
    expect(pickThread(undefined, 7)).toEqual({ threadId: 7, seq: 1, by: 'rail' });
    expect(pickThread({ threadId: 7, seq: 1, by: 'rail' }, 9)).toEqual({ threadId: 9, seq: 2, by: 'rail' });
  });

  it('lights the thread again when it is picked again', () => {
    const first = pickThread(undefined, 7);
    const again = pickThread(first, 7);

    expect(threadMarkOf(7, again).highlight).not.toBe(threadMarkOf(7, first).highlight);
    // The card restarts its light on a change of parity (`data-highlight` is 0 or 1).
    expect(again.seq % 2).not.toBe(first.seq % 2);
  });
});

describe('pickOnFocus', () => {
  it('makes the thread the conversation is opened at the current one', () => {
    expect(pickOnFocus(undefined, 7)).toEqual({ threadId: 7, seq: 1, by: 'page' });
  });

  it('lights it again when it was the one picked in Open', () => {
    const picked = pickThread(undefined, 7);

    expect(pickOnFocus(picked, 7)).toEqual({ threadId: 7, seq: 2, by: 'page' });
  });

  it('goes to the reply a link names, in its thread', () => {
    expect(pickOnFocus(undefined, 7, 9)).toEqual({ threadId: 7, replyId: 9, seq: 1, by: 'page' });
    expect(pickOnFocus(pickOnFocus(undefined, 7, 9), 7)).toEqual({ threadId: 7, seq: 2, by: 'page' });
  });

  it('keeps what was picked when a tab is shown as it is, with no thread to go to', () => {
    const picked = pickThread(undefined, 7);

    expect(pickOnFocus(picked, undefined)).toBe(picked);
    expect(pickOnFocus(undefined, undefined)).toBeUndefined();
  });
});

describe('a pick in Open and the page opened at a thread', () => {
  it('a rail pick after a page focus, then a page focus on the earlier thread, picks it again', () => {
    // Opened at 7 (Show in conversation), 9 picked in Open, then Show in conversation at 7 again (from See in context).
    const openedAt = { kind: 'codeReview', reviewId: 41, tab: 'conversation', focusThread: 7 } as const;
    const railPicked = pickThread(pickOnFocus(undefined, conversationFocus(openedAt)), 9);
    const afterPick = pageAfterOpenPick(openedAt);
    const kept = pickOnFocus(railPicked, conversationFocus(afterPick));
    expect(threadMarkOf(9, kept).selected).toBe(true);

    // The tab sees the thread asked for again only as a change of what the page names.
    const askedAgain = { ...afterPick, focusThread: 7 };
    expect(conversationFocus(askedAgain)).not.toBe(conversationFocus(afterPick));
    const again = pickOnFocus(kept, conversationFocus(askedAgain));
    expect(threadMarkOf(7, again)).toEqual({ highlight: again!.seq, selected: true });
    expect(threadMarkOf(9, again).selected).toBe(false);
  });
});

describe('threadMarkOf', () => {
  it('lights and rings the picked thread, and only it', () => {
    const picked = pickThread(pickThread(undefined, 3), 7);

    expect(threadMarkOf(7, picked)).toEqual({ highlight: 2, selected: true });
    expect(threadMarkOf(3, picked)).toEqual({ highlight: undefined, selected: false });
  });

  it('lights the reply a link names rather than its thread, which it rings', () => {
    expect(threadMarkOf(7, pickOnFocus(undefined, 7, 9))).toEqual({ highlight: 1, selected: true, litReply: 9 });
    expect(threadMarkOf(3, pickOnFocus(undefined, 7, 9))).toEqual({ highlight: undefined, selected: false });
  });

  it('marks nothing before a thread is picked', () => {
    expect(threadMarkOf(7, undefined)).toEqual({ highlight: undefined, selected: false });
  });
});

describe('pickedScrollOf', () => {
  it('leaves a thread picked in Open where it is when on screen, else glides it to the nearest edge', () => {
    expect(pickedScrollOf(pickThread(undefined, 7))).toEqual({ block: 'nearest', behavior: 'smooth' });
  });

  it('opens the page with the thread it goes to centered, at once', () => {
    expect(pickedScrollOf(pickOnFocus(undefined, 7)!)).toEqual({ block: 'center', behavior: 'auto' });
  });
});

describe('cardLightOf', () => {
  it('lights the reply a link opens the card at, from its first render, not the card', () => {
    expect(cardLightOf(1, 9, null)).toEqual({ litComment: { replyId: 9, seq: 1, scrolls: false } });
  });

  it('lights it again when the page moves to it in place, the conversation scrolling to it', () => {
    expect(cardLightOf(2, 9, null)).toEqual({ litComment: { replyId: 9, seq: 2, scrolls: false } });
  });

  it('lights the whole card for a later pick naming no reply', () => {
    expect(cardLightOf(3, undefined, null)).toEqual({ cardHighlight: 3 });
    expect(cardLightOf(undefined, undefined, null)).toEqual({});
  });

  it('lights the answer the Answered pill goes to, scrolling it into view', () => {
    const answer = nextAnswerLight(cardLightOf(undefined, undefined, null), 12, undefined);

    expect(cardLightOf(undefined, undefined, answer)).toEqual({ litComment: { replyId: 12, seq: 0, scrolls: true } });
  });

  // As before links to replies: the card's light and the answer's are apart, and a pick doesn't put the answer out.
  it('keeps the answer lit when the card is gone to again without a reply', () => {
    const answer = nextAnswerLight({}, 12, undefined);

    expect(cardLightOf(4, undefined, answer)).toEqual({ cardHighlight: 4, litComment: { replyId: 12, seq: 0, scrolls: true } });
  });

  it('lights whichever came last: the answer pressed after a reply was gone to, a reply gone to after the answer', () => {
    const atReply = cardLightOf(1, 9, null);
    const answer = nextAnswerLight(atReply, 12, 1);

    expect(cardLightOf(1, 9, answer)).toEqual({ litComment: { replyId: 12, seq: 2, scrolls: true } });
    expect(cardLightOf(2, 9, answer)).toEqual({ litComment: { replyId: 9, seq: 2, scrolls: false } });
  });

  it('lights the same reply again when the pill goes to the one a link lit, its light restarting', () => {
    const atReply = cardLightOf(1, 12, null);

    expect(nextAnswerLight(atReply, 12, 1).seq % 2).not.toBe(atReply.litComment!.seq % 2);
  });
});

describe('pickedElementId', () => {
  it('brings the picked thread into view, or the reply a link names in it', () => {
    expect(pickedElementId(pickThread(undefined, 7))).toBe(threadElementId(7));
    expect(pickedElementId(pickOnFocus(undefined, 7, 9)!)).toBe(commentElementId(9));
  });
});

describe('openItemsOf', () => {
  const open = openThreads(
    threadsOf([
      comment(1, { kind: 'changeRequest', anchor: ON_LINE, text: 'Rename **this**\nand that' }),
      comment(2, { text: 'Why not shelve?' }),
      comment(3, { anchor: ON_LINE, changesetId: 4 }),
    ]),
  );

  it('says each open thread in a line, the picked one current', () => {
    const items = openItemsOf(41, open, pickThread(undefined, 2));

    expect(items.map(({ threadId, current }) => [threadId, current])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
    expect(items[0]!.text).toBe('Rename this');
  });

  it('marks none current while the picked thread is no longer open', () => {
    expect(openItemsOf(41, open, pickThread(undefined, 9)).some((item) => item.current)).toBe(false);
  });

  it('shows one on a line in Changes, as its file link does: the file, its mode, the thread', () => {
    const [onLine, general, byChangeset] = openItemsOf(41, open, undefined);

    expect(onLine!.inChanges).toEqual({
      page: { kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Assets/Scripts/SwitchFlow.cs', focusThread: 1 },
      path: 'Assets/Scripts/SwitchFlow.cs',
    });
    expect(byChangeset!.inChanges?.page).toEqual({ kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Assets/Scripts/SwitchFlow.cs', focusThread: 3, focusChangeset: 4 });
    // On the whole review, it is in no file.
    expect(general!.inChanges).toBeUndefined();
  });
});
