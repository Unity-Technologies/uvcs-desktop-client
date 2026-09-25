/** Common filter for list views backed by `cm find`. */
export interface QueryFilter {
  /** ISO date (`YYYY-MM-DD`); only objects created on or after it. */
  sinceDate?: string;
  owner?: 'me' | string;
  branch?: string;
  includeHidden?: boolean;
  limit?: number;
}
