import { placeId, type Place } from '@shared/domain/place';
import type { BranchName } from './branchNames';
import { ownCopy } from './ownCopy';

type ReadAll = (place: Place) => Promise<BranchName[]>;

/** A branch rename shows in the code review lists after this long at most. */
const MAX_AGE_MS = 10 * 60_000;

/**
 * Branch names by object id, as code reviews name their branches. Branch lists already read answer them
 * (`remember`); only when some id is unknown and no complete list is recent is every branch's name read, once, in two
 * light queries. An id missing from a complete list is a deleted branch.
 */
export class BranchNamesCache {
  /** By place (`placeId`), then branch id. */
  private readonly entries = new Map<string, Map<number, { name: string; readAt: number }>>();
  private readonly completeAt = new Map<string, number>();
  private readonly reading = new Map<string, Promise<ReadonlyMap<number, string>>>();

  /**
   * `isShown`: whether some window shows the place (`isShown` in `watchShownWorkspaces`). Names are kept only then: a
   * read that ends after the last window let the place go (`forget`) would keep them for the session.
   */
  constructor(
    private readonly readAll: ReadAll,
    private readonly now: () => number = Date.now,
    private readonly isShown: (place: Place) => boolean = () => true,
  ) {}

  /** Names read along with something else (a branch list); `complete` when it holds every branch, hidden ones too. */
  remember(place: Place, branches: readonly BranchName[], { complete = false } = {}): void {
    if (!this.isShown(place)) return;
    const key = placeId(place);
    const readAt = this.now();
    let entries = this.entries.get(key);
    if (!entries) this.entries.set(key, (entries = new Map()));
    for (const { id, name } of branches) entries.set(id, { name: ownCopy(name), readAt });
    if (complete) this.completeAt.set(key, readAt);
  }

  async resolve(place: Place, ids: number[]): Promise<Map<number, string>> {
    const unknown = ids.some((id) => this.nameOf(place, id) === undefined) && !this.isComplete(place);
    // What the read found answers this lookup even where it isn't kept.
    const read = unknown ? await this.readEvery(place) : undefined;
    const names = new Map<number, string>();
    for (const id of ids) {
      const name = this.nameOf(place, id) ?? read?.get(id);
      if (name !== undefined) names.set(id, name);
    }
    return names;
  }

  /**
   * No window shows the place anymore (`WorkspaceWatchers` `stopped`): its names go, megabytes on a repository of
   * 20,000 branches, and a read under way keeps none.
   */
  forget(place: Place): void {
    const key = placeId(place);
    this.entries.delete(key);
    this.completeAt.delete(key);
    this.reading.delete(key);
  }

  private nameOf(place: Place, id: number): string | undefined {
    const entry = this.entries.get(placeId(place))?.get(id);
    return entry && this.now() - entry.readAt < MAX_AGE_MS ? entry.name : undefined;
  }

  private isComplete(place: Place): boolean {
    const completeAt = this.completeAt.get(placeId(place));
    return completeAt !== undefined && this.now() - completeAt < MAX_AGE_MS;
  }

  /** Reads every branch name, by id; lookups meanwhile wait for the same read. */
  private readEvery(place: Place): Promise<ReadonlyMap<number, string>> {
    const key = placeId(place);
    const running = this.reading.get(key);
    if (running) return running;
    // A read the place was forgotten during (`forget`) keeps nothing.
    const isCurrent = (): boolean => this.reading.get(key) === read;
    const read: Promise<ReadonlyMap<number, string>> = this.readAll(place)
      .then((branches) => {
        if (isCurrent()) this.remember(place, branches, { complete: true });
        return new Map(branches.map(({ id, name }) => [id, name]));
      })
      .finally(() => {
        if (isCurrent()) this.reading.delete(key);
      });
    this.reading.set(key, read);
    return read;
  }
}
