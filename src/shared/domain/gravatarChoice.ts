import type { AppSettings } from './settings';

/**
 * Nothing goes to Gravatar until the user chooses it: pictures are off until asked (the one-time prompt, or the
 * Settings checkbox), and either answer is recorded so the question never comes back.
 */
export type GravatarChoice = Pick<AppSettings, 'showGravatar' | 'gravatarChoiceAsked'>;

/** What the settings become once the user answers, in the prompt or in Settings. */
export function gravatarChoice(show: boolean): GravatarChoice {
  return { showGravatar: show, gravatarChoiceAsked: true };
}

/** Pictures are fetched only when the user turned them on themselves. */
export function showsGravatar(settings: GravatarChoice): boolean {
  return settings.gravatarChoiceAsked && settings.showGravatar;
}

/**
 * The choice held by settings as saved, by this version or one from before the question existed. Those saved
 * `showGravatar` without `gravatarChoiceAsked`, with every other setting (`SettingsStore` writes them all), when
 * pictures were on by default: off there can only be the user's choice, kept as answered; on may be only the old
 * default, which nobody chose, so pictures are off until the user answers (and Settings shows them off).
 */
export function storedGravatarChoice(stored: Partial<GravatarChoice>): GravatarChoice {
  if (stored.gravatarChoiceAsked === undefined && stored.showGravatar === false) return gravatarChoice(false);
  const asked = stored.gravatarChoiceAsked ?? false;
  return { showGravatar: asked && (stored.showGravatar ?? false), gravatarChoiceAsked: asked };
}
