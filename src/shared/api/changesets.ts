import type { Changeset } from '../domain/changeset';
import type { Place } from '../domain/place';
import type { QueryFilter } from '../domain/query';
import type { OneObjectRead } from './oneObjectRead';

export interface ChangesetsApi {
  /** Newest first. */
  list(place: Place, filter: QueryFilter): Promise<Changeset[]>;
  /** `repository` reads a changeset of another repository than the place's (an item's, under an xlink). */
  get(place: Place, changesetId: number, repository?: string): Promise<Changeset>;
  /** One changeset by its number, or null when the repository has none by it: a comment's chip of another repository. */
  find(place: Place, changesetId: number, read?: OneObjectRead): Promise<Changeset | null>;
  editComment(place: Place, changesetId: number, comment: string): Promise<void>;
  /** Moves the changeset and its descendants to another branch (full name, e.g. `/main/fix`). */
  moveToBranch(place: Place, changesetId: number, branch: string): Promise<void>;
  remove(place: Place, changesetId: number): Promise<void>;
}
