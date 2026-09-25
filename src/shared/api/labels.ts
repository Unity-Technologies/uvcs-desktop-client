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
  create(workspacePath: string, request: CreateLabelRequest): Promise<void>;
  rename(workspacePath: string, label: string, newName: string): Promise<void>;
  delete(workspacePath: string, labels: string[]): Promise<void>;
}
