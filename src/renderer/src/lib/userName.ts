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

/** Avatar hues that read well in both themes; purples are left out so avatars never compete with the accent. */
const AVATAR_HUES = [205, 190, 170, 150, 125, 45, 30, 15, 355, 335];

/** A stable hue per user, so the same person always gets the same avatar color. */
export function userHue(user: string): number {
  let hash = 0;
  for (const char of user) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]!;
}
