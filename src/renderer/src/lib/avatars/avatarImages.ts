import { useSyncExternalStore } from 'react';
import { gravatarUrl } from './gravatar';

/** One image per user, large enough for the biggest avatar at 2x (retina). */
const IMAGE_SIZE = 96;

type Entry = { state: 'loading' } | { state: 'loaded'; image: HTMLImageElement } | { state: 'missing' };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

/**
 * The user's avatar image once it has loaded, or null (initials should be shown).
 * The first request for a user starts a background load; results are kept for the session,
 * shared by every list and the Branch Explorer canvas.
 */
export function avatarImageFor(user: string): HTMLImageElement | null {
  const key = user.trim().toLowerCase();
  const entry = entries.get(key);
  if (!entry) {
    entries.set(key, { state: 'loading' });
    void load(key);
    return null;
  }
  return entry.state === 'loaded' ? entry.image : null;
}

/** Called whenever an avatar finishes loading, e.g. to repaint a canvas. */
export function subscribeToAvatars(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding: re-renders when the user's avatar image becomes available. */
export function useAvatarImage(user: string): HTMLImageElement | null {
  return useSyncExternalStore(subscribeToAvatars, () => avatarImageFor(user));
}

async function load(key: string): Promise<void> {
  const url = await gravatarUrl(key, IMAGE_SIZE);
  const image = url ? await loadImage(url) : null;
  entries.set(key, image ? { state: 'loaded', image } : { state: 'missing' });
  if (image) listeners.forEach((listener) => listener());
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
