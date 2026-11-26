import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BindingKeptBySpec, RepositoryTrackerBinding, TrackerConnection } from '@shared/domain/issueTrackers';
import { repositoryKey } from '@shared/domain/repository';
import { parseRepositoryGuid, type RepositoryGuid } from '@shared/domain/stableIds';
import { replaceFileSync } from '../files/replaceFileSync';

/** A connection as it is kept: its credential's state is the secrets' to say. */
export type StoredConnection = Omit<TrackerConnection, 'credential'>;

/** A binding as it is kept: by the repository's GUID, or by its spec when made before (`BindingKeptBySpec`). */
type StoredBinding = BindingKeptBySpec;

interface StoredTrackers {
  connections: StoredConnection[];
  bindings: StoredBinding[];
}

const EMPTY: StoredTrackers = { connections: [], bindings: [] };

/**
 * The connections and which repositories use them (docs/features/issue-trackers.md, "Where they're kept"):
 * `issue-trackers.json` in the user data folder, apart from `settings.json`, which the renderer writes whole. Changed
 * only by the service's typed methods; replaced whole or not at all (`replaceFileSync`).
 */
export class IssueTrackerStore {
  private stored: StoredTrackers | null = null;

  constructor(private readonly filePath: string) {}

  connections(): readonly StoredConnection[] {
    return this.read().connections;
  }

  /** The bindings kept by the repository's GUID. */
  bindings(): readonly RepositoryTrackerBinding[] {
    return this.read().bindings.flatMap((binding) => {
      const repository = parseRepositoryGuid(binding.repository);
      return repository ? [{ ...binding, repository }] : [];
    });
  }

  /** The bindings still kept by the repository's spec, until its GUID is known (`keepRepositoryByGuid`). */
  bindingsKeptBySpec(): readonly BindingKeptBySpec[] {
    return this.read().bindings.filter((binding) => !parseRepositoryGuid(binding.repository));
  }

  connection(id: string): StoredConnection | undefined {
    return this.read().connections.find((connection) => connection.id === id);
  }

  /** Adds a connection, or replaces the one with its id. */
  saveConnection(connection: StoredConnection): void {
    const { connections, bindings } = this.read();
    this.write({ connections: [...connections.filter((kept) => kept.id !== connection.id), connection], bindings });
  }

  /** Removes a connection and the bindings that used it. */
  removeConnection(id: string): void {
    const { connections, bindings } = this.read();
    this.write({ connections: connections.filter((kept) => kept.id !== id), bindings: bindings.filter((binding) => binding.connectionId !== id) });
  }

  /** Binds a repository, replacing any binding it had: one tracker per repository. */
  bind(binding: RepositoryTrackerBinding): void {
    const { connections, bindings } = this.read();
    this.write({ connections, bindings: [...bindings.filter((kept) => kept.repository !== binding.repository), binding] });
  }

  unbind(repository: RepositoryGuid): void {
    const { connections, bindings } = this.read();
    this.write({ connections, bindings: bindings.filter((kept) => kept.repository !== repository) });
  }

  /**
   * A binding kept by the repository's spec, however written (`repositoryKey`), before bindings were kept by its GUID,
   * moves to its GUID once it is known; dropped when the GUID has one of its own. Whether a binding moved: nothing is written when none did.
   */
  keepRepositoryByGuid(spec: string, guid: RepositoryGuid): boolean {
    const { connections, bindings } = this.read();
    const bySpec = this.bindingsKeptBySpec().find((binding) => repositoryKey(binding.repository) === repositoryKey(spec));
    if (!bySpec) return false;
    const others = bindings.filter((binding) => binding !== bySpec);
    const byGuid = others.some((binding) => binding.repository === guid);
    this.write({ connections, bindings: byGuid ? others : [...others, { ...bySpec, repository: guid }] });
    return true;
  }

  private read(): StoredTrackers {
    if (this.stored) return this.stored;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<StoredTrackers>;
      this.stored = { connections: parsed.connections ?? [], bindings: parsed.bindings ?? [] };
    } catch {
      this.stored = EMPTY;
    }
    return this.stored;
  }

  private write(stored: StoredTrackers): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    replaceFileSync(this.filePath, JSON.stringify(stored, null, 2));
    this.stored = stored;
  }
}
