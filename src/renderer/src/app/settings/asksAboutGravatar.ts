import type { GravatarChoice } from '@shared/domain/gravatarChoice';

/**
 * Whether to ask the user about Gravatar pictures now: once people show in the window (`usePeopleShown`), until they
 * answer, in the prompt or in Settings. Settings not read yet (undefined) never ask: they may hold the answer.
 */
export function asksAboutGravatar(settings: GravatarChoice | undefined, peopleShown: boolean): boolean {
  return settings !== undefined && !settings.gravatarChoiceAsked && peopleShown;
}
