/** Helpers to build `cm` object specs. See `cm help objectspec`. */
export const spec = {
  branch: (name: string): string => `br:${name}`,
  changeset: (id: number): string => `cs:${id}`,
  label: (name: string): string => `lb:${name}`,
  shelve: (id: number): string => `sh:${id}`,
  revision: (revisionId: number): string => `revid:${revisionId}`,
  itemAtChangeset: (itemId: number, changesetId: number): string => `itemid:${itemId}#cs:${changesetId}`,
  serverPathAtChangeset: (serverPath: string, changesetId: number): string =>
    `serverpath:${serverPath}#cs:${changesetId}`,
  /** An item at any point in history, given as a changeset or shelve spec (`cs:12`, `sh:3`). */
  itemAt: (itemId: number, pointSpec: string): string => `itemid:${itemId}#${pointSpec}`,
  serverPathAt: (serverPath: string, pointSpec: string): string => `serverpath:${serverPath}#${pointSpec}`,
};

export function repositorySpec(name: string, server: string): string {
  return `${name}@${server}`;
}

export function shortBranchName(fullName: string): string {
  return fullName.split('/').filter(Boolean).at(-1) ?? fullName;
}
