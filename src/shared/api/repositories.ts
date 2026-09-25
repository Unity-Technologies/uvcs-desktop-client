import type { RepositorySummary, ServerProfile } from '../domain/repository';

export interface RepositoriesApi {
  /** Servers with a connection profile, plus the local server. */
  servers(): Promise<ServerProfile[]>;
  list(server: string): Promise<RepositorySummary[]>;
  create(server: string, name: string): Promise<RepositorySummary>;
  rename(repositorySpec: string, newName: string): Promise<void>;
  remove(repositorySpec: string): Promise<void>;
}
