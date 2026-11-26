import type { RepositoryListing } from '@shared/domain/repository';
import { serverKey } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';

/**
 * A listing this recent answers a repository it doesn't hold as unknown instead of listing again: the repository was
 * just looked for, and a lookup of a name nobody can see (a typo in a link, a repository the user has no access to)
 * lists its server once a minute at most.
 */
const FRESH_LISTING_MS = 60_000;

/**
 * The GUID of each repository by its name, per server: what the app keeps a repository's settings by, since a name
 * changes with a rename (ARCHITECTURE.md "Settings survive renames"). Only `cm repository list` prints a repository's
 * GUID, `{repguid}`: neither `cm status --header` nor `cm find` does, and no spec takes one. So every listing of a
 * server goes through here (`list`, the home screen's too) and teaches it the server's names, and a name it doesn't know
 * lists the server again once: a repository renamed or created since. A GUID never changes, so nothing else expires.
 * Each listing replaces the server's names whole, so a name a renamed repository left behind goes with it.
 */
export class RepositoryGuids {
  /**
   * By `serverKey`: each repository's GUID by its name in lower case, as `cm` takes names in any case, and its name as
   * listed by its GUID.
   */
  private readonly byServer = new Map<string, { guids: Map<string, RepositoryGuid>; names: Map<RepositoryGuid, string>; listedAt: number }>();
  private readonly listing = new Map<string, Promise<RepositoryListing>>();

  constructor(
    private readonly listServer: (server: string) => Promise<RepositoryListing>,
    private readonly now: () => number = Date.now,
  ) {}

  /** The server's repositories, one `cm repository list` however many ask meanwhile; their GUIDs are kept. */
  list(server: string): Promise<RepositoryListing> {
    const key = serverKey(server);
    const running = this.listing.get(key);
    if (running) return running;
    const listed = this.listServer(server)
      .then((listing) => {
        this.remember(key, listing);
        return listing;
      })
      .finally(() => this.listing.delete(key));
    this.listing.set(key, listed);
    return listed;
  }

  /**
   * The GUID of the repository `name` names on `server`, listing the server when the name is unknown and the last
   * listing isn't fresh; undefined when the server holds no such repository, or `cm` printed no GUID for it. Rejects
   * when the listing fails.
   */
  async guidOf(server: string, name: string): Promise<RepositoryGuid | undefined> {
    const key = serverKey(server);
    const known = this.byServer.get(key);
    const guid = known?.guids.get(name.toLowerCase());
    if (guid || (known && this.now() - known.listedAt < FRESH_LISTING_MS)) return guid;
    await this.list(server);
    return this.byServer.get(key)?.guids.get(name.toLowerCase());
  }

  /** The GUID a listing already taught for `name` on `server`, without asking `cm`: undefined when none did. */
  knownGuidOf(server: string, name: string): RepositoryGuid | undefined {
    return this.byServer.get(serverKey(server))?.guids.get(name.toLowerCase());
  }

  /**
   * The name the repository with `guid` goes by on `server` now, as the listing writes it: what a spec kept with its
   * GUID follows when the repository was renamed (a sync remote, a window reopened at launch). Lists the server when
   * no listing taught the GUID and the last one isn't fresh; undefined when the server holds no such repository.
   * Rejects when the listing fails.
   */
  async nameOf(server: string, guid: RepositoryGuid): Promise<string | undefined> {
    const key = serverKey(server);
    const known = this.byServer.get(key);
    const name = known?.names.get(guid);
    if (name !== undefined || (known && this.now() - known.listedAt < FRESH_LISTING_MS)) return name;
    await this.list(server);
    return this.byServer.get(key)?.names.get(guid);
  }

  /**
   * A repository was created or restored on `server` here: the next lookup of a name no listing taught lists the server
   * again, however recent the last listing, so the repository just made is found.
   */
  added(server: string): void {
    const known = this.byServer.get(serverKey(server));
    if (known) known.listedAt = Number.NEGATIVE_INFINITY;
  }

  /** A repository renamed here keeps its GUID under its new name at once, without listing its server again. */
  renamed(server: string, from: string, to: string): void {
    const known = this.byServer.get(serverKey(server));
    const guid = known?.guids.get(from.toLowerCase());
    if (!known || !guid) return;
    known.guids.delete(from.toLowerCase());
    known.guids.set(to.toLowerCase(), guid);
    known.names.set(guid, to);
  }

  private remember(key: string, listing: RepositoryListing): void {
    const guids = new Map<string, RepositoryGuid>();
    const names = new Map<RepositoryGuid, string>();
    for (const { name, guid } of listing.repositories) {
      if (!guid) continue;
      guids.set(name.toLowerCase(), guid);
      names.set(guid, name);
    }
    this.byServer.set(key, { guids, names, listedAt: this.now() });
  }
}
