const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Gravatar image URL for a user, or null when the user isn't an email address.
 * Gravatar accepts SHA-256 hashes of the trimmed, lowercased email; `d=404` makes a missing
 * avatar fail to load, so callers can fall back to initials.
 */
export async function gravatarUrl(user: string, size: number): Promise<string | null> {
  const email = user.trim().toLowerCase();
  if (!EMAIL.test(email)) return null;

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `https://gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
