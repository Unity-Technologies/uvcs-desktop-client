import { createHash } from 'node:crypto';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fetches a URL: the picture's bytes and type, or null when there is none (404) or it can't be reached. */
export type FetchImage = (url: string) => Promise<{ type: string; bytes: Uint8Array } | null>;

/**
 * Gravatar image URL for a user, or null when the user isn't an email address. Gravatar accepts SHA-256 hashes of the
 * trimmed, lowercased email; `d=404` answers 404 for someone without a picture, so the app shows their initials.
 */
export function gravatarUrl(user: string, size: number): string | null {
  const email = user.trim().toLowerCase();
  if (!EMAIL.test(email)) return null;
  return `https://gravatar.com/avatar/${createHash('sha256').update(email).digest('hex')}?s=${size}&d=404`;
}

/**
 * Profile pictures, fetched here rather than by the page: someone without one answers 404, which would be logged as a
 * console error for every such user. Every answer, missing pictures and failures included, is kept for the session.
 */
export class GravatarCache {
  private readonly pictures = new Map<string, Promise<string | null>>();

  constructor(private readonly fetchImage: FetchImage) {}

  /** A data URL of the user's picture, or null when they have none (or it couldn't be read). */
  picture(user: string, size: number): Promise<string | null> {
    const url = gravatarUrl(user, size);
    if (!url) return Promise.resolve(null);
    let picture = this.pictures.get(url);
    if (!picture) {
      picture = this.fetchImage(url).then(
        (image) => image && `data:${image.type};base64,${Buffer.from(image.bytes).toString('base64')}`,
        () => null,
      );
      this.pictures.set(url, picture);
    }
    return picture;
  }
}
