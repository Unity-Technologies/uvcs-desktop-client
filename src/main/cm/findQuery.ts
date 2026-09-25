import type { QueryFilter } from '@shared/domain/query';

/**
 * Builds `cm find` arguments: `<object> "<where/order/limit>" --xml --nototal`.
 * `orderBy` is null for objects `cm` cannot sort (shelves).
 */
export function findArgs(object: string, filter: QueryFilter, orderBy: string | null, extraConditions: string[] = []): string[] {
  const order = orderBy ? ` order by ${orderBy}` : '';
  const limit = filter.limit ? ` limit ${filter.limit}` : '';
  const conditions = filter.text ? [...extraConditions, textCondition(object, filter.text)] : extraConditions;
  return ['find', object, `${whereClause(filter, conditions)}${order}${limit}`.trim(), '--xml', '--nototal'];
}

/** The field `QueryFilter.text` searches in, per object. */
const TEXT_FIELDS: Record<string, string> = { branch: 'name', label: 'name', changeset: 'comment', shelve: 'comment', review: 'title' };

function textCondition(object: string, text: string): string {
  const field = TEXT_FIELDS[object];
  if (!field) throw new Error(`Cannot search ${object} objects by text.`);
  return `${field} like '${escapeQueryValue(caseTolerantPattern(text))}'`;
}

/**
 * `like` is case-sensitive in `cm find`, and there is no `lower()`. Leaving out the first letter of each word, the one
 * that usually changes case, finds `Bamboo plugin` for "bamboo plugin" in a single scan: `%amboo%lugin%`.
 * All-caps words are still missed, and some extra objects match, so results should be filtered precisely afterwards.
 */
export function caseTolerantPattern(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  return `%${words.map((word) => (word.length > 1 ? word.slice(1) : word)).join('%')}%`;
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
