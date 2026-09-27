/** `jane.doe@unity3d.com` → `Jane Doe`. */
export function displayName(user: string): string {
  const local = user.split('@')[0] ?? user;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function initials(user: string): string {
  const words = displayName(user).split(' ');
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** What a filter matches a user by: the name shown (which `UserLabel` highlights), and the user as stored. */
export function userFilterTexts(user: string): string[] {
  return [displayName(user), user];
}
