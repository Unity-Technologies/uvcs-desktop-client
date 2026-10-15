import type { BranchName } from './branchNames';
import { ownCopy } from './ownCopy';

type ReadAll = (workspacePath: string) => Promise<BranchName[]>;

/** A branch rename shows in the code review lists after this long at most. */
const MAX_AGE_MS = 10 * 60_000;

/**
 * Branch names by object id, as code reviews name their branches. Branch lists already read answer them
 * (`remember`); only when some id is unknown and no complete list is recent is every branch's name read, once, in two
 * light queries. An id missing from a complete list is a deleted branch.
 */
export class BranchNamesCache {
  /** By workspace, then branch id. */
  private readonly entries = new Map<string, Map<number, { name: string; readAt: number }>>();
  private readonly completeAt = new Map<string, number>();
  private readonly reading = new Map<string, Promise<ReadonlyMap<number, string>>>();

  /**
   * `isShown`: whether some window shows the workspace (`isShown` in `watchShownWorkspaces`). Names are kept only
   * then: a read that ends after the last window let the workspace go (`forget`) would keep them for the session.
   */
  constructor(
    private readonly readAll: ReadAll,
    private readonly now: () => number = Date.now,
    private readonly isShown: (workspacePath: string) => boolean = () => true,
  ) {}

  /** Names read along with something else (a branch list); `complete` when it holds every branch, hidden ones too. */
  remember(workspacePath: string, branches: readonly BranchName[], { complete = false } = {}): void {
    if (!this.isShown(workspacePath)) return;
    const readAt = this.now();
    let entries = this.entries.get(workspacePath);
    if (!entries) this.entries.set(workspacePath, (entries = new Map()));
    for (const { id, name } of branches) entries.set(id, { name: ownCopy(name), readAt });
    if (complete) this.completeAt.set(workspacePath, readAt);
  }

  async resolve(workspacePath: string, ids: number[]): Promise<Map<number, string>> {
    const unknown = ids.some((id) => this.nameOf(workspacePath, id) === undefined) && !this.isComplete(workspacePath);
    // What the read found answers this lookup even where it isn't kept.
    const read = unknown ? await this.readEvery(workspacePath) : undefined;
    const names = new Map<number, string>();
    for (const id of ids) {
      const name = this.nameOf(workspacePath, id) ?? read?.get(id);
      if (name !== undefined) names.set(id, name);
    }
    return names;
  }

  /**
   * No window shows the workspace anymore (`WorkspaceWatchers` `stopped`): its names go, megabytes on a repository of
   * 20,000 branches, and a read under way keeps none.
   */
  forget(workspacePath: string): void {
    this.entries.delete(workspacePath);
    this.completeAt.delete(workspacePath);
    this.reading.delete(workspacePath);
  }

  private nameOf(workspacePath: string, id: number): string | undefined {
    const entry = this.entries.get(workspacePath)?.get(id);
    return entry && this.now() - entry.readAt < MAX_AGE_MS ? entry.name : undefined;
  }

  private isComplete(workspacePath: string): boolean {
    const completeAt = this.completeAt.get(workspacePath);
    return completeAt !== undefined && this.now() - completeAt < MAX_AGE_MS;
  }

  /** Reads every branch name, by id; lookups meanwhile wait for the same read. */
  private readEvery(workspacePath: string): Promise<ReadonlyMap<number, string>> {
    const running = this.reading.get(workspacePath);
    if (running) return running;
    // A read the workspace was forgotten during (`forget`) keeps nothing.
    const isCurrent = (): boolean => this.reading.get(workspacePath) === read;
    const read: Promise<ReadonlyMap<number, string>> = this.readAll(workspacePath)
      .then((branches) => {
        if (isCurrent()) this.remember(workspacePath, branches, { complete: true });
        return new Map(branches.map(({ id, name }) => [id, name]));
      })
      .finally(() => {
        if (isCurrent()) this.reading.delete(workspacePath);
      });
    this.reading.set(workspacePath, read);
    return read;
  }
}
