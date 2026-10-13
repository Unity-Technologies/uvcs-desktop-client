import { describe, expect, it } from 'vitest';
import { gravatarChoice, showsGravatar, withGravatarAskedFirst } from './gravatarChoice';
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

describe('settings saved before the user was asked', () => {
  it('turn pictures off that were on only by the old default', () => {
    expect(withGravatarAskedFirst({ theme: 'dark', showGravatar: true, gravatarChoiceAsked: false })).toEqual({
      theme: 'dark',
      showGravatar: false,
      gravatarChoiceAsked: false,
    });
  });

  it('keep what the user chose', () => {
    expect(withGravatarAskedFirst(gravatarChoice(true))).toEqual(gravatarChoice(true));
    expect(withGravatarAskedFirst(gravatarChoice(false))).toEqual(gravatarChoice(false));
  });
});
