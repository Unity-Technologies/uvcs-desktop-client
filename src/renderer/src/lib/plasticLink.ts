/**
 * A `plastic://` link that opens the changeset's diff (or the diff of a range, from the changeset after `fromChangeset`)
 * in the Plastic desktop client: `plastic://acme.cloud/repos/acme/changesets/273075/diff`. The server's `@` becomes
 * `.` (`acme@cloud` → `acme.cloud`), and the repository name is URL-encoded with spaces as `+`.
 */
export function changesetLink(repositoryName: string, server: string, changesetId: number, fromChangeset?: number): string {
  const changesets = fromChangeset === undefined ? `${changesetId}` : `${fromChangeset}..${changesetId}`;
  return `plastic://${server.replaceAll('@', '.')}/repos/${encodeRepositoryName(repositoryName)}/changesets/${changesets}/diff`;
}

function encodeRepositoryName(name: string): string {
  return encodeURIComponent(name).replaceAll('%20', '+');
}
