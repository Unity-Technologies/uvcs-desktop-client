/** Why what is kept for a repository can't be read or saved: its server holds no repository by that name. */
export function repositoryNotFound(repositorySpec: string): string {
  return `Couldn't find ${repositorySpec} on its server. It may have been deleted, or you may no longer have access to it.`;
}
