/**
 * Shelves created while switching with pending changes use the official client's comment, so the official
 * Desktop and `cm` recognize them too (see AutomaticShelveComment.cs in the Plastic sources):
 * `Automatic shelve created during switch operation (from br:<branch id>)`, `(from cs:<changeset number>)`
 * or `(from lb:<label id>)`.
 */
const AUTOMATIC_SHELVE_COMMENT = 'Automatic shelve created during switch operation';

/** `objectRef` is where the changes were made: `br:<branch id>`, `cs:<changeset number>` or `lb:<label id>`. */
export function automaticShelveComment(objectRef: string): string {
  return `${AUTOMATIC_SHELVE_COMMENT} (from ${objectRef})`;
}

/** The `cm find shelve` condition matching every automatic shelve. */
export const AUTOMATIC_SHELVE_CONDITION = `comment like '${AUTOMATIC_SHELVE_COMMENT}%'`;

export interface CreatedShelve {
  id: number;
  /** `name@server`. */
  repository: string;
}

/**
 * Parses the "Created shelve sh:12@repo@server (mount:'/')" lines of `cm shelveset create`. Changes inside
 * writable Xlinks are shelved in their own repository, one line each.
 */
export function parseCreatedShelves(output: string): CreatedShelve[] {
  return [...output.matchAll(/^Created shelve sh:(\d+)@(\S+)/gm)].map((match) => ({ id: Number(match[1]), repository: match[2]! }));
}
