import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RepositoryTrackerBinding, TrackerConnection } from '@shared/domain/issueTrackers';
import { sameRepository } from '@shared/issueTrackers/issueReferences';
import { replaceFileSync } from '../files/replaceFileSync';

/** A connection as it is kept: its credential's state is the secrets' to say. */
export type StoredConnection = Omit<TrackerConnection, 'credential'>;

interface StoredTrackers {
  connections: StoredConnection[];
  bindings: RepositoryTrackerBinding[];
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

  bindings(): readonly RepositoryTrackerBinding[] {
    return this.read().bindings;
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
    this.write({ connections, bindings: [...bindings.filter((kept) => !sameRepository(kept.repository, binding.repository)), binding] });
  }

  unbind(repository: string): void {
    const { connections, bindings } = this.read();
    this.write({ connections, bindings: bindings.filter((kept) => !sameRepository(kept.repository, repository)) });
  }

  /** A repository renamed in the app keeps its tracker. */
  renameRepository(from: string, to: string): void {
    const { connections, bindings } = this.read();
    if (!bindings.some((binding) => sameRepository(binding.repository, from))) return;
    this.write({ connections, bindings: bindings.map((binding) => (sameRepository(binding.repository, from) ? { ...binding, repository: to } : binding)) });
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
