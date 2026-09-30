/**
 * State kept on disk per key (a workspace, a repository): read once, then kept in memory; saved one write after
 * another, so an older state never lands last. `read` answers the state a key starts from, empty when its file can't
 * be read.
 */
export class PersistedByKey<State> {
  private readonly loaded = new Map<string, Promise<State>>();
  private readonly saves = new Map<string, Promise<void>>();

  constructor(private readonly read: (key: string) => Promise<State>) {}

  /** The key's state, read from disk the first time only: later calls share it, changes made to it included. */
  load(key: string): Promise<State> {
    let state = this.loaded.get(key);
    if (!state) {
      state = this.read(key);
      this.loaded.set(key, state);
    }
    return state;
  }

  /** Runs `write` once the key's earlier saves are done, failed or not; fails if it does. */
  save(key: string, write: () => Promise<void>): Promise<void> {
    const previous = this.saves.get(key) ?? Promise.resolve();
    const next = previous.then(write);
    this.saves.set(key, next.catch(() => undefined));
    return next;
  }
}
