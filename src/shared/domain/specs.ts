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
};

export function repositorySpec(name: string, server: string): string {
  return `${name}@${server}`;
}

export function shortBranchName(fullName: string): string {
  return fullName.split('/').filter(Boolean).at(-1) ?? fullName;
}
