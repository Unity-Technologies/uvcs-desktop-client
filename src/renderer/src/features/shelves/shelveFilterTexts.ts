import type { Shelve } from '@shared/domain/shelve';
import { spec } from '@shared/domain/specs';
import { userFilterTexts } from '../../lib/userName';

/** What a shelve's row shows, which the Shelves view's filter looks through, and the `sh:` suggestions too. */
export function shelveFilterTexts(shelve: Shelve): string[] {
  return [String(shelve.id), shelve.comment, spec.changeset(shelve.parentChangeset), ...userFilterTexts(shelve.owner)];
}
