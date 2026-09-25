import type { QueryFilter } from '@shared/domain/query';

/** Builds the `where` clause of a `cm find` query from the common list filter. */
export function whereClause(filter: QueryFilter, extraConditions: string[] = []): string {
  const conditions = [...extraConditions];
  if (filter.sinceDate) conditions.push(`date >= '${filter.sinceDate}'`);
  if (filter.owner) conditions.push(`owner = '${escapeQueryValue(filter.owner)}'`);
  if (filter.branch) conditions.push(`branch = '${escapeQueryValue(filter.branch)}'`);
  return conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
}

export function escapeQueryValue(value: string): string {
  return value.replace(/'/g, "''");
}
