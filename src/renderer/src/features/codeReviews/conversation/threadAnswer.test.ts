import { describe, expect, it } from 'vitest';
import { answerOpenedByHand, answerShownOnReturn, keepsAnswerDraft } from './threadAnswer';

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

describe('keepsAnswerDraft', () => {
  it('counts only words as a draft worth showing', () => {
    expect(keepsAnswerDraft(undefined)).toBe(false);
    expect(keepsAnswerDraft(draft('\t'))).toBe(false);
    expect(keepsAnswerDraft(draft('ok'))).toBe(true);
  });
});
