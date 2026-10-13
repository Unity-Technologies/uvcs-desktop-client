import type { GravatarChoice } from '@shared/domain/gravatarChoice';

/** What the window shows now. */
export interface GravatarPromptMoment {
  /** People showed in the window (`usePeopleShown`). */
  peopleShown: boolean;
  /** A dialog is open: the card would sit over it, and its buttons, until the dialog closes. */
  dialogOpen: boolean;
}

/**
 * Whether to ask the user about Gravatar pictures now: once people show in the window, until they answer, in the
 * prompt or in Settings; while a dialog is open the question waits for it to close. Settings not read yet (undefined)
 * never ask: they may hold the answer.
 */
export function asksAboutGravatar(settings: GravatarChoice | undefined, { peopleShown, dialogOpen }: GravatarPromptMoment): boolean {
  return settings !== undefined && !settings.gravatarChoiceAsked && peopleShown && !dialogOpen;
}
