/** Common filter for list views backed by `cm find`. */
export interface QueryFilter {
  /** ISO date (`YYYY-MM-DD`); only objects created on or after it. */
  sinceDate?: string;
  /**
   * Only objects by one of these users (`me` is the user `cm` signs in as). Picked by hand from the people a list shows,
   * so a few names at most (`MAX_PICKED_PEOPLE`); sorted, so the same people ask the same query.
   */
  owners?: readonly string[];
  branch?: string;
  includeHidden?: boolean;
  limit?: number;
  /**
   * Only objects whose name (branches, labels), comment (changesets, shelves) or title (code reviews) contains its words,
   * in order. `cm` compares case-sensitively, so the first letter of each word is left out: expect some extra matches.
   */
  text?: string;
}
