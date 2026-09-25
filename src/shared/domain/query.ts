/** Common filter for list views backed by `cm find`. */
export interface QueryFilter {
  /** ISO date (`YYYY-MM-DD`); only objects created on or after it. */
  sinceDate?: string;
  owner?: 'me' | string;
  branch?: string;
  includeHidden?: boolean;
  limit?: number;
  /**
   * Only objects whose name (branches, labels), comment (changesets, shelves) or title (code reviews) contains its words,
   * in order. `cm` compares case-sensitively, so the first letter of each word is left out: expect some extra matches.
   */
  text?: string;
}
