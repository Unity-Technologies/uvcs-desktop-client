import type { QueryFilter } from '@shared/domain/query';

/**
 * Builds `cm find` arguments: `<object> "<where/order/limit>" --xml --nototal`.
 * `orderBy` is null for objects `cm` cannot sort (shelves).
 */
export function findArgs(object: string, filter: QueryFilter, orderBy: string | null, extraConditions: string[] = []): string[] {
  const order = orderBy ? ` order by ${orderBy}` : '';
  const limit = filter.limit ? ` limit ${filter.limit}` : '';
  return ['find', object, `${whereClause(filter, extraConditions)}${order}${limit}`.trim(), '--xml', '--nototal'];
}

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
