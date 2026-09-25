type Lookup = (workspacePath: string, ids: number[]) => Promise<Map<number, string>>;

/** A branch rename shows in the code review lists after this long at most. */
const MAX_AGE_MS = 10 * 60_000;

/**
 * Branch names by object id, remembered for a while: code review lists resolve the same few hundred ids on every
 * refresh, and only the ids not seen lately go to the server. Ids that resolved to nothing are remembered too.
 */
export class BranchNamesCache {
  private readonly entries = new Map<string, { name: string | undefined; readAt: number }>();

  constructor(
    private readonly lookup: Lookup,
    private readonly now: () => number = Date.now,
  ) {}

  /** Names read along with something else (a branch list), so resolving them later costs nothing. */
  remember(workspacePath: string, branches: readonly { id: number; name: string }[]): void {
    const readAt = this.now();
    for (const { id, name } of branches) this.entries.set(entryKey(workspacePath, id), { name, readAt });
  }

  async resolve(workspacePath: string, ids: number[]): Promise<Map<number, string>> {
    const key = (id: number) => entryKey(workspacePath, id);
    const isFresh = (id: number) => {
      const entry = this.entries.get(key(id));
      return entry !== undefined && this.now() - entry.readAt < MAX_AGE_MS;
    };

    const unknown = [...new Set(ids)].filter((id) => !isFresh(id));
    if (unknown.length > 0) {
      const found = await this.lookup(workspacePath, unknown);
      const readAt = this.now();
      for (const id of unknown) this.entries.set(key(id), { name: found.get(id), readAt });
    }

    const names = new Map<number, string>();
    for (const id of ids) {
      const name = this.entries.get(key(id))?.name;
      if (name !== undefined) names.set(id, name);
    }
    return names;
  }
}

function entryKey(workspacePath: string, id: number): string {
  return `${workspacePath}\n${id}`;
}
