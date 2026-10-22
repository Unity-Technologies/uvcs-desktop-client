import type { Label } from '../domain/label';
import type { QueryFilter } from '../domain/query';

export interface CreateLabelRequest {
  name: string;
  /** The changeset to label; the workspace's loaded changeset when omitted. */
  changesetId?: number;
  comment: string;
}

export interface LabelsApi {
  list(workspacePath: string, filter: QueryFilter): Promise<Label[]>;
  /** One label by its name (a light `cm find`), or null when there is none: a link names labels so. */
  get(workspacePath: string, name: string): Promise<Label | null>;
  create(workspacePath: string, request: CreateLabelRequest): Promise<void>;
  rename(workspacePath: string, label: string, newName: string): Promise<void>;
  /** Replaces the label's comment; it can't be emptied. */
  editComment(workspacePath: string, label: Pick<Label, 'name' | 'changeset' | 'repository'>, comment: string): Promise<void>;
  delete(workspacePath: string, labels: string[]): Promise<void>;
}
