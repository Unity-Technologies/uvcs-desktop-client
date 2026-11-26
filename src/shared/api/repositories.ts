import type { RepositoryListing, ServerProfile } from '../domain/repository';
import type { RepositoryGuid } from '../domain/stableIds';

export interface RepositoriesApi {
  /** Servers with a connection profile, plus the local server. */
  servers(): Promise<ServerProfile[]>;
  /** Its repositories, and a Unity organization's projects, from one `cm repository list`. */
  list(server: string): Promise<RepositoryListing>;
  /**
   * The GUID of the repository a spec names (`name@server`), which what the app keeps for it is kept by
   * (ARCHITECTURE.md "Settings survive renames"): free when its server was listed, else one listing. Null when the
   * server holds no such repository, or `cm` prints no GUID; rejects when the server can't be listed.
   */
  guidOf(repositorySpec: string): Promise<RepositoryGuid | null>;
  /**
   * The spec a repository kept by its spec and GUID goes by now: the same while its name names it, else the name a
   * rename made anywhere gave it, on the same server; the same too once the server holds it no more. Free when its
   * server was listed, else one listing; rejects when the server can't be listed.
   */
  specNow(repositorySpec: string, guid: RepositoryGuid): Promise<string>;
  /** Creates a repository on the server: resolves to its spec, `name@server`. */
  create(server: string, name: string): Promise<string>;
  rename(repositorySpec: string, newName: string): Promise<void>;
  remove(repositorySpec: string): Promise<void>;
  /**
   * Restores one of the listing's `deletedRepositories` by its spec (`<guid>@<server>`): under the name it had, or
   * `newName` when another repository took it.
   */
  restore(deletedSpec: string, newName?: string): Promise<void>;
}
