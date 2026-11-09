import type { CommentReference } from '../../lib/comments/commentReferences';
import { commentLineText } from '../../lib/comments/commentText';
import type { CachedRecord } from './chipContent';

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

export interface CachedObject {
  id?: unknown;
  name?: unknown;
  comment?: unknown;
  title?: unknown;
  status?: unknown;
  owner?: unknown;
  date?: unknown;
}

/** Each list read once into its objects by what a reference names them by (`id:12`, `name:/main`), kept as long as it. */
const indexes = new WeakMap<readonly unknown[], Map<string, CachedObject>>();
/** Each object's summary, read once: a summary reads the comment as Markdown. */
const summaries = new WeakMap<CachedObject, string | undefined>();

/**
 * A reference's summary (its comment's first line without marks, a review's title) from the place's lists the window
 * already read (every branch, the newest changesets…). Nothing is asked for: a chip shows its summary once something
 * read it (docs/features/rich-comments.md, "What a chip reads"). An object read alone is left out: it may be another
 * repository's (an xlink's changeset is cached in the place's area by its id); only `lookedUp`, a changeset read by
 * its number in the place's own repository, counts. Each list is indexed once, so a lookup
 * costs no walk over thousands of rows whenever the cache changes.
 */
export function summaryIn(cached: readonly unknown[], reference: CommentReference, lookedUp?: unknown): string | undefined {
  const object = cachedObjectIn(cached, reference, lookedUp);
  return object && summaryOf(object);
}

/**
 * The object a reference names in what the window read, as `summaryIn` finds it, for its hover card (`chipCard`):
 * the same object while its list stays read, so a chip renders again only when it does.
 */
export function cachedObjectIn(cached: readonly unknown[], reference: CommentReference, lookedUp?: unknown): CachedObject | undefined {
  const key = keyOf(reference);
  if (!key) return undefined;
  // The object looked up alone in the place's own repository (`useChangeset` with no other one: a number typed).
  if (isObject(lookedUp) && `id:${String(lookedUp.id)}` === key) return lookedUp;
  for (const data of cached) {
    if (!Array.isArray(data)) continue;
    const object = indexOf(data).get(key);
    if (object) return object;
  }
  return undefined;
}

/** What a hover card shows of a cached object: its text fields, whichever it has. */
export function cachedRecordOf(object: CachedObject): CachedRecord {
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  return { comment: text(object.comment), title: text(object.title), status: text(object.status), owner: text(object.owner), date: text(object.date) };
}


function keyOf(reference: CommentReference): string | null {
  switch (reference.kind) {
    case 'branch':
    case 'label':
      return `name:${reference.name}`;
    case 'changeset':
    case 'shelve':
    case 'codeReview':
      return `id:${reference.id}`;
    default:
      return null;
  }
}

function indexOf(list: readonly unknown[]): Map<string, CachedObject> {
  let index = indexes.get(list);
  if (!index) {
    index = new Map();
    for (const object of list) {
      if (!isObject(object)) continue;
      if (typeof object.name === 'string') index.set(`name:${object.name}`, object);
      if (typeof object.id === 'number') index.set(`id:${object.id}`, object);
    }
    indexes.set(list, index);
  }
  return index;
}

/** A cached object's summary (its comment's first line without marks, a review's title), read once. */
export function summaryOf(object: CachedObject): string | undefined {
  if (!summaries.has(object)) {
    const text = typeof object.title === 'string' ? object.title : typeof object.comment === 'string' ? object.comment : '';
    summaries.set(object, commentLineText(text) || undefined);
  }
  return summaries.get(object);
}

function isObject(value: unknown): value is CachedObject {
  return typeof value === 'object' && value !== null;
}
