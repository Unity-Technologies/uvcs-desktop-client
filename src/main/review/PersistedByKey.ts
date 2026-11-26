/**
 * State kept on disk per key (a workspace, a repository): read once, then kept in memory; saved one write after
 * another, so an older state never lands last. `read` answers the state a key starts from, empty when its file can't
 * be read; a read that fails (where the file is couldn't be told) isn't kept, and the next load reads again.
 */
export class PersistedByKey<State, Key extends string = string> {
  private readonly loaded = new Map<Key, Promise<State>>();
  private readonly saves = new Map<Key, Promise<void>>();

  constructor(private readonly read: (key: Key) => Promise<State>) {}

  /** The key's state, read from disk the first time only: later calls share it, changes made to it included. */
  load(key: Key): Promise<State> {
    let state = this.loaded.get(key);
    if (!state) {
      const read = this.read(key);
      read.catch(() => this.loaded.get(key) === read && this.loaded.delete(key));
      this.loaded.set(key, (state = read));
    }
    return state;
  }

  /** Whether the key's state was read this session. */
  has(key: Key): boolean {
    return this.loaded.has(key);
  }

  /** Runs `write` once the key's earlier saves are done, failed or not; fails if it does. */
  save(key: Key, write: () => Promise<void>): Promise<void> {
    const previous = this.saves.get(key) ?? Promise.resolve();
    const next = previous.then(write);
    this.saves.set(key, next.catch(() => undefined));
    return next;
  }
}
