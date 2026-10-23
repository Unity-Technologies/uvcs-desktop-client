import type { Label } from '../domain/label';
import type { Place } from '../domain/place';
import type { QueryFilter } from '../domain/query';

export interface CreateLabelRequest {
  name: string;
  /** The changeset to label; the workspace's loaded changeset when omitted, which a repository with none can't. */
  changesetId?: number;
  comment: string;
}

export interface LabelsApi {
  list(place: Place, filter: QueryFilter): Promise<Label[]>;
  /** One label by its name (a light `cm find`), or null when there is none: a link names labels so. */
  get(place: Place, name: string): Promise<Label | null>;
  create(place: Place, request: CreateLabelRequest): Promise<void>;
  rename(place: Place, label: string, newName: string): Promise<void>;
  /** Replaces the label's comment; it can't be emptied. */
  editComment(place: Place, label: Pick<Label, 'name' | 'changeset' | 'repository'>, comment: string): Promise<void>;
  delete(place: Place, labels: string[]): Promise<void>;
}
