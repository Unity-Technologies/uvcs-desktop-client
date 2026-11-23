import { describe, expect, it } from 'vitest';
import { initialThreadCardFold, nextThreadCardFold, type ThreadCardFold } from './threadCardFold';
import { answerShownOnReturn, type AnswerBox } from './threadAnswer';

const folded: ThreadCardFold = { folded: true, editsRoot: false };
const whole: ThreadCardFold = { folded: false, editsRoot: false };
const noBox: AnswerBox = { answering: null, focuses: false };
const draft = (description: string) => ({ summary: '', description });

describe('initialThreadCardFold', () => {
  it('starts a settled thread folded and an open one whole, with no editor waiting', () => {
    expect(initialThreadCardFold({ state: { kind: 'applied', changesetId: 4 } }, undefined, noBox)).toEqual(folded);
    expect(initialThreadCardFold({ state: { kind: 'open' } }, undefined, noBox)).toEqual(whole);
  });

  it('starts a thread gone to whole, even settled', () => {
    expect(initialThreadCardFold({ state: { kind: 'discarded' } }, 0, noBox)).toEqual(whole);
  });

  it('starts a settled thread whole when a reply to it was left unsent, so its draft shows', () => {
    const box = answerShownOnReturn({ reply: draft('One more thing'), discard: undefined }, false);
    expect(initialThreadCardFold({ state: { kind: 'answered' } }, undefined, box)).toEqual(whole);
  });

  it('keeps a settled thread folded when only a discard was left unsent: it can no longer be discarded', () => {
    const box = answerShownOnReturn({ reply: undefined, discard: draft('Not needed') }, false);
    expect(initialThreadCardFold({ state: { kind: 'applied', changesetId: 4 } }, undefined, box)).toEqual(folded);
  });
});

describe('nextThreadCardFold', () => {
  it("unfolds the card at its first comment's editor when Edit is picked on the folded line's menu", () => {
    expect(nextThreadCardFold(folded, 'editRoot')).toEqual({ folded: false, editsRoot: true });
  });

  it('spends the edit once the editor has opened, so nothing that shows the thread again reopens it', () => {
    expect(nextThreadCardFold({ folded: false, editsRoot: true }, 'editorOpened')).toEqual(whole);
  });

  it('clears an edit still waiting when the card folds', () => {
    expect(nextThreadCardFold({ folded: false, editsRoot: true }, 'toggle')).toEqual(folded);
  });

  it('opens no editor when the card unfolds from its folded line or its chevron', () => {
    expect(nextThreadCardFold(folded, 'unfold')).toEqual(whole);
    expect(nextThreadCardFold(folded, 'toggle')).toEqual(whole);
  });

  it('leaves a whole card whole when it is shown again (gone to, its answer seen)', () => {
    expect(nextThreadCardFold(whole, 'unfold')).toEqual(whole);
  });
});
