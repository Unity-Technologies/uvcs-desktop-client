import type { RepositoryListing, ServerProfile } from '../domain/repository';

export interface RepositoriesApi {
  /** Servers with a connection profile, plus the local server. */
  servers(): Promise<ServerProfile[]>;
  /** Its repositories, and a Unity organization's projects, from one `cm repository list`. */
  list(server: string): Promise<RepositoryListing>;
  /** Creates a repository on the server: resolves to its spec, `name@server`. */
  create(server: string, name: string): Promise<string>;
  rename(repositorySpec: string, newName: string): Promise<void>;
  remove(repositorySpec: string): Promise<void>;
}
