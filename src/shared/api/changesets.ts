import type { Changeset } from '../domain/changeset';
import type { Place } from '../domain/place';
import type { QueryFilter } from '../domain/query';

export interface ChangesetsApi {
  /** Newest first. */
  list(place: Place, filter: QueryFilter): Promise<Changeset[]>;
  /** `repository` reads a changeset of another repository than the place's (an item's, under an xlink). */
  get(place: Place, changesetId: number, repository?: string): Promise<Changeset>;
  editComment(place: Place, changesetId: number, comment: string): Promise<void>;
  /** Moves the changeset and its descendants to another branch (full name, e.g. `/main/fix`). */
  moveToBranch(place: Place, changesetId: number, branch: string): Promise<void>;
  remove(place: Place, changesetId: number): Promise<void>;
}
