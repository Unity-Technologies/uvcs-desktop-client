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
  return `${field} like '${withoutQuotes(caseTolerantPattern(text))}'`;
}

/**
 * `cm find` reads no quote inside a value (neither doubled nor between double quotes), so each one in a `like`
 * pattern matches any text instead: the pattern is loose already, and results are filtered precisely afterwards.
 */
function withoutQuotes(pattern: string): string {
  return pattern.replace(/['"]/g, '%');
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
  if (filter.owners?.length) conditions.push(ownersCondition(filter.owners));
  if (filter.branch) conditions.push(equalsCondition('branch', filter.branch));
  return conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
}

/**
 * Objects by any of a few users: `owner = 'ana'`, or `(owner = 'me' or owner = 'ana')`. Names, never ids, picked by
 * hand (a handful), so the query stays one bounded scan; `cm` has no `in (...)`.
 */
function ownersCondition(owners: readonly string[]): string {
  const each = owners.map((owner) => equalsCondition('owner', owner));
  return each.length === 1 ? each[0]! : `(${each.join(' or ')})`;
}

/**
 * `field` is `value`. A value holding a quote, which `cm find` can't read, is matched with a wildcard in each quote's
 * place instead (`withoutQuotes`): more objects than asked for, so a caller that needs the exact ones filters the
 * results. Branch, label, attribute and repository names can't hold a quote (`cm` refuses to create one); people's
 * names and emails can (`o'brien@corp.com`).
 */
export function equalsCondition(field: string, value: string): string {
  return /['"]/.test(value) ? `${field} like '${withoutQuotes(value)}'` : `${field} = '${value}'`;
}
