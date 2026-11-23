import { describe, expect, it } from 'vitest';
import { answerDraftOf, answerOpenedByHand, answerShownOnReturn, followDrafts, nextAnswerBox, type AnswerBox, type AnswerDrafts, type AnswerFollowing } from './threadAnswer';

const drafts = (reply: AnswerDrafts['reply'], discard: AnswerDrafts['discard'] = 'none'): AnswerDrafts => ({ reply, discard });
const closed: AnswerBox = { answering: null, focuses: false };
const replying: AnswerBox = { answering: 'reply', focuses: false };
const discarding: AnswerBox = { answering: 'discard', focuses: false };

describe('answerDraftOf', () => {
  it('tells a draft with words from one emptied, or left with only spaces, and from none', () => {
    expect(answerDraftOf(undefined)).toBe('none');
    expect(answerDraftOf({ summary: '', description: '' })).toBe('empty');
    expect(answerDraftOf({ summary: '', description: ' \n\t' })).toBe('empty');
    expect(answerDraftOf({ summary: '', description: 'ok' })).toBe('words');
  });
});

describe('answerShownOnReturn', () => {
  it('shows only the Reply… prompt when nothing was left unsent', () => {
    expect(answerShownOnReturn(drafts('none'), true)).toEqual(closed);
  });

  it('opens a reply left unsent with its text, without taking the focus', () => {
    expect(answerShownOnReturn(drafts('words'), false)).toEqual(replying);
  });

  it('keeps a reply emptied before leaving folded to the prompt', () => {
    expect(answerShownOnReturn(drafts('empty'), true)).toEqual(closed);
  });

  it('opens a discard left unsent while the user may still discard the change request', () => {
    expect(answerShownOnReturn(drafts('none', 'words'), true)).toEqual(discarding);
  });

  it('leaves a discard draft closed once the change request can no longer be discarded', () => {
    expect(answerShownOnReturn(drafts('none', 'words'), false)).toEqual(closed);
  });

  it('opens the reply when both were left unsent: the box shows one at a time', () => {
    expect(answerShownOnReturn(drafts('words', 'words'), true)).toEqual(replying);
  });
});

describe('answerOpenedByHand', () => {
  it('takes the focus to the box the user opened', () => {
    expect(answerOpenedByHand('reply')).toEqual({ answering: 'reply', focuses: true });
    expect(answerOpenedByHand('discard')).toEqual({ answering: 'discard', focuses: true });
  });
});

describe('nextAnswerBox', () => {
  it('opens the reply, without the focus, once the same thread elsewhere (the other tab) starts holding words', () => {
    expect(nextAnswerBox(closed, drafts('none'), drafts('words'), false, false)).toEqual(replying);
  });

  it('opens a discard left unsent once the user is known and may discard', () => {
    expect(nextAnswerBox(closed, drafts('none', 'words'), drafts('none', 'words'), true, false)).toEqual(discarding);
  });

  it('closes the box once its draft is sent or cancelled elsewhere', () => {
    expect(nextAnswerBox(replying, drafts('words'), drafts('none'), false, false)).toEqual(closed);
  });

  it('keeps the box open while the focus is in it, even with its draft gone', () => {
    const box: AnswerBox = { answering: 'reply', focuses: true };
    expect(nextAnswerBox(box, drafts('words'), drafts('none'), false, true)).toBe(box);
  });

  it('keeps a box opened by hand open before anything is written in it', () => {
    const box: AnswerBox = { answering: 'reply', focuses: true };
    expect(nextAnswerBox(box, drafts('none'), drafts('none'), false, false)).toBe(box);
  });

  it('keeps a box open while its draft is emptied elsewhere, as it still holds a draft', () => {
    expect(nextAnswerBox(replying, drafts('words'), drafts('empty'), false, false)).toBe(replying);
  });

  it('leaves the box closed when nothing holds words', () => {
    expect(nextAnswerBox(closed, drafts('none'), drafts('empty'), true, false)).toBe(closed);
  });

  it('keeps an open discard box open when the reply draft is forgotten: it is not its draft', () => {
    expect(nextAnswerBox(discarding, drafts('words', 'words'), drafts('none', 'words'), true, false)).toBe(discarding);
  });

  it('shows a discard left unsent once the reply box closes for a reply sent elsewhere, as coming back would', () => {
    expect(nextAnswerBox(replying, drafts('words', 'words'), drafts('none', 'words'), true, false)).toEqual(discarding);
  });
});

describe('followDrafts', () => {
  const start: AnswerFollowing = { box: closed, seen: drafts('none') };

  it('says to unfold the card when words written elsewhere open its box', () => {
    expect(followDrafts(start, drafts('words'), false, false)).toEqual({ following: { box: replying, seen: drafts('words') }, unfolds: true });
  });

  it('unfolds nothing when the box was already open or stays closed', () => {
    expect(followDrafts({ box: replying, seen: drafts('words') }, drafts('empty'), false, false).unfolds).toBe(false);
    expect(followDrafts(start, drafts('empty'), false, false).unfolds).toBe(false);
  });

  it('keeps what it has when nothing changed, so the card renders nothing new', () => {
    const seen = drafts('words');
    const following: AnswerFollowing = { box: replying, seen };
    expect(followDrafts(following, seen, false, false).following).toBe(following);
  });

  it('advances what it has seen: a reply sent elsewhere closes the box each time, the second too', () => {
    const steps: AnswerDrafts[] = [drafts('words'), drafts('none'), drafts('words'), drafts('none')];
    const boxes = [];
    let following = start;
    for (const step of steps) {
      following = followDrafts(following, step, false, false).following;
      boxes.push(following.box);
    }
    expect(boxes).toEqual([replying, closed, replying, closed]);
  });
});
