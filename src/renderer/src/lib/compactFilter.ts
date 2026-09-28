import type { QueryFilter } from '@shared/domain/query';

/**
 * The filter without the fields that ask for nothing (undefined, false, empty, no owners), so equivalent filters share
 * a query key.
 */
export function compactFilter<Filter extends object = QueryFilter>(filter: Filter): Filter {
  return Object.fromEntries(Object.entries(filter).filter(([, value]) => !asksForNothing(value))) as Filter;
}

function asksForNothing(value: unknown): boolean {
  return value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0);
}
