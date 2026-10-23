import type { Place } from '@shared/domain/place';
import type { PageSeed } from '@shared/domain/pageWindow';
import { queryKeys } from '../../api/queryKeys';
import { listedChangeset } from '../../features/changesets/useChangeset';
import { listedShelve } from '../../features/shelves/cachedShelve';
import type { Page } from '../navigation/pages';
import { queryClient } from '../queryClient';

/**
 * The object a diff page shows, from a list this window already read (`PageSeed`): a changeset's (a label's too) or a
 * shelve's. Undefined when no list read it, or for another page: its window reads it as it would anyway.
 */
export function pageSeed(place: Place, page: Page): PageSeed | undefined {
  if (page.kind !== 'diff') return undefined;
  const { target } = page;
  if (target.kind === 'changeset') {
    const listed = listedChangeset(place, target.changesetId);
    return listed && { readAt: listed.readAt, changeset: listed.changeset };
  }
  if (target.kind === 'shelve') {
    const listed = listedShelve(place, target.shelveId);
    return listed && { readAt: listed.readAt, shelve: listed.shelve };
  }
  return undefined;
}

/**
 * Puts what a page window was handed in its cache as a list read when its window read it, where the page looks for
 * what it shows (`useChangeset`, `cachedShelve`): it shows at once, and is read again only once that list would be.
 */
export function plantPageSeed(place: Place, seed: PageSeed): void {
  const options = { updatedAt: seed.readAt };
  if (seed.changeset) plant(queryKeys.inPlace(place, 'changesets', 'handedOver'), seed.changeset.id, [seed.changeset], options);
  if (seed.shelve) plant(queryKeys.inPlace(place, 'shelves', 'handedOver'), seed.shelve.id, [seed.shelve], options);
}

/**
 * Kept while the window lives: nothing observes them, and a shelve's page reads its row at every render
 * (`cachedShelve`), so the usual collection of unused queries would take its header and actions after five minutes.
 * They are a row each.
 */
function plant(handedOver: readonly unknown[], id: number, rows: unknown[], options: { updatedAt: number }): void {
  queryClient.setQueryDefaults(handedOver, { gcTime: Infinity });
  queryClient.setQueryData([...handedOver, id], rows, options);
}
