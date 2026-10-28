import type { CommentReference } from '../../lib/comments/commentReferences';
import { firstLine } from '../../lib/text';

/** The query area each object kind is cached under (`queryKeys.inPlace(place, area, …)`). */
export type CachedArea = 'changesets' | 'branches' | 'labels' | 'shelves' | 'codeReviews';

/** Where a reference's object would be cached, when it is one of the place's own; null for anything else. */
export function cachedAreaOf(reference: CommentReference): CachedArea | null {
  if ('repository' in reference && reference.repository) return null;
  switch (reference.kind) {
    case 'changeset':
      return 'changesets';
    case 'branch':
      return 'branches';
    case 'label':
      return 'labels';
    case 'shelve':
      return 'shelves';
    case 'codeReview':
      return 'codeReviews';
    default:
      return null;
  }
}

interface CachedObject {
  id?: unknown;
  name?: unknown;
  comment?: unknown;
  title?: unknown;
}

/**
 * A reference's summary (its comment's first line, a review's title) from what the window has already read of its
 * area: a list (every branch, the newest changesets…) or the object alone. Nothing is asked for: a chip shows its
 * summary once something read it (docs/features/rich-comments.md, "What a chip reads").
 */
export function summaryIn(cached: readonly unknown[], reference: CommentReference): string | undefined {
  for (const data of cached) {
    const objects = Array.isArray(data) ? data : [data];
    for (const object of objects) {
      if (isObject(object) && names(object, reference)) return summaryOf(object);
    }
  }
  return undefined;
}

function names(object: CachedObject, reference: CommentReference): boolean {
  switch (reference.kind) {
    case 'branch':
    case 'label':
      return object.name === reference.name;
    case 'changeset':
    case 'shelve':
    case 'codeReview':
      return object.id === reference.id;
    default:
      return false;
  }
}

function summaryOf(object: CachedObject): string | undefined {
  const text = typeof object.title === 'string' ? object.title : typeof object.comment === 'string' ? object.comment : '';
  return firstLine(text) || undefined;
}

function isObject(value: unknown): value is CachedObject {
  return typeof value === 'object' && value !== null;
}
