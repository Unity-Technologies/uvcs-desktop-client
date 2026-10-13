import { describe, expect, it } from 'vitest';
import { gravatarChoice } from '@shared/domain/gravatarChoice';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { asksAboutGravatar } from './asksAboutGravatar';

describe('asking about Gravatar pictures', () => {
  it('waits for people to show: never at launch with nobody on screen', () => {
    expect(asksAboutGravatar(DEFAULT_SETTINGS, false)).toBe(false);
  });

  it('asks once people show and the user never chose', () => {
    expect(asksAboutGravatar(DEFAULT_SETTINGS, true)).toBe(true);
    expect(asksAboutGravatar({ showGravatar: false, gravatarChoiceAsked: false }, true)).toBe(true);
  });

  it('never asks again once the user answered, either way', () => {
    expect(asksAboutGravatar(gravatarChoice(true), true)).toBe(false);
    expect(asksAboutGravatar(gravatarChoice(false), true)).toBe(false);
  });

  it('waits for the settings, which may hold the answer', () => {
    expect(asksAboutGravatar(undefined, true)).toBe(false);
  });
});
