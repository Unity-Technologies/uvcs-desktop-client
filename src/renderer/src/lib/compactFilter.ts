import type { QueryFilter } from '@shared/domain/query';

/** The filter without the fields that ask for nothing (undefined, false, empty), so equivalent filters share a query key. */
export function compactFilter(filter: QueryFilter): QueryFilter {
  return Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined && value !== false && value !== '')) as QueryFilter;
}
