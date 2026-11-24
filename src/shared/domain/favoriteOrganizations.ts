// The organizations a user marked as favorites, kept by their server (`acme@unity`, `acme@cloud`) in the app's own
// settings (`AppSettings.favoriteOrganizations`). The home sidebar lists them first, so someone in dozens of
// organizations keeps the ones they use in sight (docs/features/accounts.md "Home").

/** Whether the server is among the favorites, whatever its case: `cm` and links may write `Acme@unity` or `acme@unity`. */
export function isFavoriteOrganization(favorites: readonly string[], server: string): boolean {
  return favorites.some((favorite) => sameServer(favorite, server));
}

/** The favorites with the server added (once) or removed. */
export function withFavoriteOrganization(favorites: readonly string[], server: string, favorite: boolean): string[] {
  const others = favorites.filter((listed) => !sameServer(listed, server));
  return favorite ? [...others, server] : others;
}

function sameServer(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}
