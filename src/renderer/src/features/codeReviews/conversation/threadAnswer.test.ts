import { describe, expect, it } from 'vitest';
import { answerOpenedByHand, answerShownOnReturn, nextAnswerBox, type AnswerBox, type AnswerDrafts } from './threadAnswer';

const draft = (description: string) => ({ summary: '', description });

describe('answerShownOnReturn', () => {
  it('shows only the Reply… prompt when nothing was left unsent', () => {
    expect(answerShownOnReturn({ reply: undefined, discard: undefined }, true)).toEqual({ answering: null, focuses: false });
  });

  it('opens a reply left unsent with its text, without taking the focus', () => {
    expect(answerShownOnReturn({ reply: draft('Looks right to me'), discard: undefined }, false)).toEqual({ answering: 'reply', focuses: false });
  });

  it('keeps a reply emptied, or left with only spaces, folded to the prompt', () => {
    expect(answerShownOnReturn({ reply: draft(''), discard: undefined }, true)).toEqual({ answering: null, focuses: false });
    expect(answerShownOnReturn({ reply: draft(' \n '), discard: undefined }, true)).toEqual({ answering: null, focuses: false });
  });

  it('opens a discard left unsent while the user may still discard the change request', () => {
    expect(answerShownOnReturn({ reply: undefined, discard: draft('Not needed') }, true)).toEqual({ answering: 'discard', focuses: false });
  });

  it('leaves a discard draft closed once the change request can no longer be discarded', () => {
    expect(answerShownOnReturn({ reply: undefined, discard: draft('Not needed') }, false)).toEqual({ answering: null, focuses: false });
  });

  it('opens the reply when both were left unsent: the box shows one at a time', () => {
    expect(answerShownOnReturn({ reply: draft('Thanks'), discard: draft('Not needed') }, true)).toEqual({ answering: 'reply', focuses: false });
  });
});

describe('answerOpenedByHand', () => {
  it('takes the focus to the box the user opened', () => {
    expect(answerOpenedByHand('reply')).toEqual({ answering: 'reply', focuses: true });
    expect(answerOpenedByHand('discard')).toEqual({ answering: 'discard', focuses: true });
  });
});

describe('nextAnswerBox', () => {
  const none: AnswerDrafts = { reply: undefined, discard: undefined };
  const closed: AnswerBox = { answering: null, focuses: false };
  const replying: AnswerBox = { answering: 'reply', focuses: false };

  it('opens the reply, without the focus, once the same thread elsewhere (the other tab) starts holding words', () => {
    expect(nextAnswerBox(closed, none, { reply: draft('On it'), discard: undefined }, false, false)).toEqual(replying);
  });

  it('opens a discard left unsent once the user is known and may discard', () => {
    const drafts = { reply: undefined, discard: draft('Not needed') };
    expect(nextAnswerBox(closed, drafts, drafts, true, false)).toEqual({ answering: 'discard', focuses: false });
  });

  it('closes the box once its draft is sent or cancelled elsewhere', () => {
    expect(nextAnswerBox(replying, { reply: draft('On it'), discard: undefined }, none, false, false)).toEqual(closed);
  });

  it('keeps the box open while the focus is in it, even with its draft gone', () => {
    const box: AnswerBox = { answering: 'reply', focuses: true };
    expect(nextAnswerBox(box, { reply: draft('On it'), discard: undefined }, none, false, true)).toBe(box);
  });

  it('keeps a box opened by hand open before anything is written in it', () => {
    const box: AnswerBox = { answering: 'reply', focuses: true };
    expect(nextAnswerBox(box, none, none, false, false)).toBe(box);
  });

  it('keeps a box open while its draft is emptied elsewhere, as it still holds a draft', () => {
    expect(nextAnswerBox(replying, { reply: draft('On it'), discard: undefined }, { reply: draft(''), discard: undefined }, false, false)).toBe(replying);
  });

  it('leaves the box closed when nothing holds words', () => {
    expect(nextAnswerBox(closed, none, { reply: draft(' '), discard: undefined }, true, false)).toBe(closed);
  });
});
