import type { Label } from '../domain/label';
import type { QueryFilter } from '../domain/query';

export interface LabelsApi {
  list(workspacePath: string, filter: QueryFilter): Promise<Label[]>;
}
