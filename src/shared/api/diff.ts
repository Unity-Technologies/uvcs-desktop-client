import type { DiffEntry, DiffTarget } from '../domain/diff';

export interface DiffApi {
  /** Items that differ for the target, sorted by path. */
  entries(workspacePath: string, target: DiffTarget): Promise<DiffEntry[]>;
}
