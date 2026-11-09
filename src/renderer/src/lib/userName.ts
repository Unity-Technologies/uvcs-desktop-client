/** `jane.doe@unity3d.com` → `Jane Doe`. */
export function displayName(user: string): string {
  const local = user.split('@')[0] ?? user;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** `jane.doe` → `JD`; a one-word name gives its first two letters (`danipen` → `DA`), as the other UVCS clients show it. */
export function initials(user: string): string {
  // NFC joins a letter written with a separate accent mark (`n` and a combining tilde) into one, so the two letters
  // shown are letters.
  const words = displayName(user).normalize('NFC').split(/\s+/).filter(Boolean);
  const [first = [], second] = words.map((word) => Array.from(word));
  const letters = second ? [first[0], second[0]] : first.slice(0, 2);
  return letters.join('').toUpperCase() || '?';
}

/** What a filter matches a user by: the name shown (which `UserLabel` highlights), and the user as stored. */
export function userFilterTexts(user: string): string[] {
  return [displayName(user), user];
}
