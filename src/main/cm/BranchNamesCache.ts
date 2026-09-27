import type { BranchName } from './branchNames';

type ReadAll = (workspacePath: string) => Promise<BranchName[]>;

/** A branch rename shows in the code review lists after this long at most. */
const MAX_AGE_MS = 10 * 60_000;

/**
 * Branch names by object id, as code reviews name their branches. Branch lists already read answer them
 * (`remember`); only when some id is unknown and no complete list is recent is every branch's name read, once, in two
 * light queries. An id missing from a complete list is a deleted branch.
 */
export class BranchNamesCache {
  private readonly entries = new Map<string, { name: string; readAt: number }>();
  private readonly completeAt = new Map<string, number>();
  private readonly reading = new Map<string, Promise<void>>();

  constructor(
    private readonly readAll: ReadAll,
    private readonly now: () => number = Date.now,
  ) {}

  /** Names read along with something else (a branch list); `complete` when it holds every branch, hidden ones too. */
  remember(workspacePath: string, branches: readonly BranchName[], { complete = false } = {}): void {
    const readAt = this.now();
    for (const { id, name } of branches) this.entries.set(entryKey(workspacePath, id), { name: ownCopy(name), readAt });
    if (complete) this.completeAt.set(workspacePath, readAt);
  }

  async resolve(workspacePath: string, ids: number[]): Promise<Map<number, string>> {
    if (ids.some((id) => this.nameOf(workspacePath, id) === undefined) && !this.isComplete(workspacePath)) {
      await this.readEvery(workspacePath);
    }
    const names = new Map<number, string>();
    for (const id of ids) {
      const name = this.nameOf(workspacePath, id);
      if (name !== undefined) names.set(id, name);
    }
    return names;
  }

  private nameOf(workspacePath: string, id: number): string | undefined {
    const entry = this.entries.get(entryKey(workspacePath, id));
    return entry && this.now() - entry.readAt < MAX_AGE_MS ? entry.name : undefined;
  }

  private isComplete(workspacePath: string): boolean {
    const completeAt = this.completeAt.get(workspacePath);
    return completeAt !== undefined && this.now() - completeAt < MAX_AGE_MS;
  }

  /** Reads every branch name; lookups meanwhile wait for the same read. */
  private readEvery(workspacePath: string): Promise<void> {
    const running = this.reading.get(workspacePath);
    if (running) return running;
    const read = this.readAll(workspacePath)
      .then((branches) => this.remember(workspacePath, branches, { complete: true }))
      .finally(() => this.reading.delete(workspacePath));
    this.reading.set(workspacePath, read);
    return read;
  }
}

/**
 * The name as a string of its own. Parsed names are slices of the command's whole output, which V8 keeps alive for as
 * long as any slice lives: kept here, the 20 MB of a 20,000-branch list would stay in memory for the whole session.
 */
function ownCopy(text: string): string {
  return Buffer.from(text, 'utf8').toString('utf8');
}

function entryKey(workspacePath: string, id: number): string {
  return `${workspacePath}\n${id}`;
}
