import type { AppSettings } from './settings';

/**
 * Nothing goes to Gravatar until the user chooses it: pictures are off until asked (the one-time prompt, or the
 * Settings checkbox), and either answer is recorded so the question never comes back.
 */
export type GravatarChoice = Pick<AppSettings, 'showGravatar' | 'gravatarChoiceAsked'>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Gravatar knows people by email address: a user named otherwise has no picture to ask for, and nothing is sent. */
export function isEmailAddress(user: string): boolean {
  return EMAIL.test(user.trim().toLowerCase());
}

/** What the settings become once the user answers, in the prompt or in Settings. */
export function gravatarChoice(show: boolean): GravatarChoice {
  return { showGravatar: show, gravatarChoiceAsked: true };
}

/** Pictures are fetched only when the user turned them on themselves. */
export function showsGravatar(settings: GravatarChoice): boolean {
  return settings.gravatarChoiceAsked && settings.showGravatar;
}

/**
 * Settings saved before the user was asked may hold `showGravatar: true` from when it was the default, which nobody
 * chose: until they answer, pictures are off (and Settings shows them off).
 */
export function withGravatarAskedFirst<T extends GravatarChoice>(settings: T): T {
  return settings.gravatarChoiceAsked || !settings.showGravatar ? settings : { ...settings, showGravatar: false };
}
