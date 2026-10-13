import { useSyncExternalStore } from 'react';
import { isEmailAddress } from '@shared/domain/gravatarChoice';

const listeners = new Set<() => void>();
let shown = false;

/**
 * Called by every person's avatar as it shows: the first one named by an email address (someone Gravatar could have a
 * picture of) marks people as shown, which is when the app asks whether to show their pictures (`GravatarPrompt`).
 * Listeners hear it after the render that showed them, as React forbids changing other components' state during one.
 */
export function notePersonShown(user: string): void {
  if (shown || !isEmailAddress(user)) return;
  shown = true;
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}

/** Someone with a picture to ask for showed in this window. */
export function havePeopleShown(): boolean {
  return shown;
}

export function subscribeToPeopleShown(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding: re-renders once people show. */
export function usePeopleShown(): boolean {
  return useSyncExternalStore(subscribeToPeopleShown, havePeopleShown);
}
