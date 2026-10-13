import { describe, expect, it } from 'vitest';
import { gravatarChoice } from '@shared/domain/gravatarChoice';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { asksAboutGravatar } from './asksAboutGravatar';

const peopleOnScreen = { peopleShown: true, dialogOpen: false };

describe('asking about Gravatar pictures', () => {
  it('waits for people to show: never at launch with nobody on screen', () => {
    expect(asksAboutGravatar(DEFAULT_SETTINGS, { peopleShown: false, dialogOpen: false })).toBe(false);
  });

  it('asks once people show and the user never chose', () => {
    expect(asksAboutGravatar(DEFAULT_SETTINGS, peopleOnScreen)).toBe(true);
    expect(asksAboutGravatar({ showGravatar: false, gravatarChoiceAsked: false }, peopleOnScreen)).toBe(true);
  });

  it('never asks again once the user answered, either way', () => {
    expect(asksAboutGravatar(gravatarChoice(true), peopleOnScreen)).toBe(false);
    expect(asksAboutGravatar(gravatarChoice(false), peopleOnScreen)).toBe(false);
  });

  it('waits for the settings, which may hold the answer', () => {
    expect(asksAboutGravatar(undefined, peopleOnScreen)).toBe(false);
  });

  it('waits while a dialog is open, Settings included, and asks once it closes', () => {
    expect(asksAboutGravatar(DEFAULT_SETTINGS, { peopleShown: true, dialogOpen: true })).toBe(false);
    expect(asksAboutGravatar(DEFAULT_SETTINGS, peopleOnScreen)).toBe(true);
  });
});
