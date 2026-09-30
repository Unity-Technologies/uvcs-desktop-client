import { useSyncExternalStore } from 'react';

/** One image per user, large enough for the biggest avatar at 2x (retina). */
const IMAGE_SIZE = 96;

type Entry = { state: 'loading' } | { state: 'loaded'; image: HTMLImageElement } | { state: 'missing' };

/** Fetches a user's picture as a data URL of `size` pixels, or null for someone without one. */
export type AvatarPictureSource = (user: string, size: number) => Promise<string | null>;

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let source: AvatarPictureSource | null = null;

/**
 * The user's avatar image once it has loaded, or null (initials should be shown).
 * The first request for a user starts a background load; results are kept for the session,
 * shared by every list and the Branch Explorer canvas.
 */
export function avatarImageFor(user: string): HTMLImageElement | null {
  if (!source) return null;
  const key = user.trim().toLowerCase();
  const entry = entries.get(key);
  if (!entry) {
    entries.set(key, { state: 'loading' });
    void load(source, key);
    return null;
  }
  return entry.state === 'loaded' ? entry.image : null;
}

/**
 * Where pictures come from, following the "Show profile pictures from Gravatar" setting (the app sets it); null while
 * it's off or not read yet: every avatar shows initials and nothing is fetched.
 */
export function setAvatarPictureSource(next: AvatarPictureSource | null): void {
  if (next === source) return;
  source = next;
  // Pictures asked for while off came back empty: ask again.
  if (source) for (const [key, entry] of entries) if (entry.state === 'missing') entries.delete(key);
  notify();
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

async function load(from: AvatarPictureSource, key: string): Promise<void> {
  const dataUrl = await from(key, IMAGE_SIZE).catch(() => null);
  const image = dataUrl ? await loadImage(dataUrl) : null;
  entries.set(key, image ? { state: 'loaded', image } : { state: 'missing' });
  if (image) notify();
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
