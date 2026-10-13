import { describe, expect, it } from 'vitest';
import { gravatarChoice, showsGravatar, storedGravatarChoice } from './gravatarChoice';
import { DEFAULT_SETTINGS } from './settings';

describe('the Gravatar choice', () => {
  it('starts off and unasked: nothing is fetched by default', () => {
    expect(DEFAULT_SETTINGS.showGravatar).toBe(false);
    expect(DEFAULT_SETTINGS.gravatarChoiceAsked).toBe(false);
    expect(showsGravatar(DEFAULT_SETTINGS)).toBe(false);
  });

  it('records the question as asked whichever the answer', () => {
    expect(gravatarChoice(true)).toEqual({ showGravatar: true, gravatarChoiceAsked: true });
    expect(gravatarChoice(false)).toEqual({ showGravatar: false, gravatarChoiceAsked: true });
  });

  it('shows pictures only when the user turned them on', () => {
    expect(showsGravatar(gravatarChoice(true))).toBe(true);
    expect(showsGravatar(gravatarChoice(false))).toBe(false);
    expect(showsGravatar({ showGravatar: true, gravatarChoiceAsked: false })).toBe(false);
  });
});

describe('the choice in saved settings', () => {
  it('keeps what the user chose', () => {
    expect(storedGravatarChoice(gravatarChoice(true))).toEqual(gravatarChoice(true));
    expect(storedGravatarChoice(gravatarChoice(false))).toEqual(gravatarChoice(false));
  });

  it('is off and unasked in settings without it', () => {
    expect(storedGravatarChoice({})).toEqual({ showGravatar: false, gravatarChoiceAsked: false });
  });

  it('turns off pictures saved before the question, when they were on by the default nobody chose', () => {
    expect(storedGravatarChoice({ showGravatar: true })).toEqual({ showGravatar: false, gravatarChoiceAsked: false });
  });

  it('keeps pictures saved off before the question as the user’s answer: the default was on', () => {
    expect(storedGravatarChoice({ showGravatar: false })).toEqual(gravatarChoice(false));
  });

  it('never shows pictures that are on but unanswered', () => {
    expect(storedGravatarChoice({ showGravatar: true, gravatarChoiceAsked: false })).toEqual({ showGravatar: false, gravatarChoiceAsked: false });
  });
});
