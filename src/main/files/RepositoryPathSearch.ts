// Finding a file by name in a repository explored without a workspace (docs/features/explore-repository.md, "Finding
// a file"). `cm` filters no tree by name, so the first search of a changeset lists its whole tree once
// (`repositoryPathsArgs`) and keeps it as a file of the session's (`SessionFolder`); every later search of it reads
// that file, never the server. Nothing holds the tree in memory: each item is written down and matched as it arrives,
// and a search keeps only its best results (`BestPaths`).

import { createHash } from 'node:crypto';
import { closeSync, createReadStream, openSync, rmSync, writeSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { FoundPathsSource } from '@shared/domain/explorer';
import type { RepositoryPlace } from '@shared/domain/place';
import { cmPlace } from '../cm/cmPlace';
import type { CmClient } from '../cm/CmClient';
import { listedPathLine, readListedPath, readListedPathLine, repositoryPathsArgs, type ListedPath } from '../cm/repositoryPaths';
import { BestPaths } from './BestPaths';
import { SessionFolder } from './SessionFolder';

export type PathSearchSource = FoundPathsSource;

export interface PathSearch {
  /** How many results it keeps, the best first. */
  limit: number;
  /** Stops it: a newer query replaced it, or its window went. The tree's listing goes on for the next search. */
  signal?: AbortSignal;
  /** The best results so far, each time they change as the paths go past. */
  onUpdate?: (paths: ListedPath[], source: PathSearchSource) => void;
}

/** Items matched between two updates, at most: a few updates for a big tree, each with the best results so far. */
const ITEMS_PER_UPDATE = 5000;

/**
 * Whole trees kept of a repository, those searched last: a window or two may go back and forth between branches, and
 * each tree let go would be listed from the server again.
 */
const TREES_KEPT = 3;

/** Bytes of lines written to a tree's file at once: the listing arrives faster than it could be written line by line. */
const WRITE_BATCH = 256 * 1024;

interface Tree {
  readonly key: string;
  repository: string;
  /** The file once the listing is done; until then, the listing every search of the tree waits for. */
  file: string | null;
  listing: Promise<string> | null;
  /** The searches matching the items as the listing reads them, and how many items it read so far. */
  readonly listeners: Set<(item: ListedPath) => void>;
  listed: number;
  readonly abort: AbortController;
}

export class RepositoryPathSearch {
  private readonly trees = new Map<string, Tree>();

  constructor(
    private readonly cm: Pick<CmClient, 'executeRecords'>,
    private readonly folder = new SessionFolder({ prefix: 'uvcs-trees-' }),
  ) {}

  /**
   * The best matches of `query` among the repository's files and folders at the changeset. The first search of a
   * changeset lists its tree from the server (one `cm ls -R`); a search asked meanwhile joins that listing; every later
   * one reads the tree's file. Fails as the listing does; a search stopped (`signal`) resolves what it found so far.
   */
  async search(place: RepositoryPlace, changesetId: number, query: string, { limit, signal, onUpdate }: PathSearch): Promise<ListedPath[]> {
    const best = new BestPaths(query, limit);
    const tree = this.treeOf(place, changesetId);
    try {
      await this.searchTree(place, changesetId, tree, best, signal, onUpdate);
    } catch (error) {
      if (!isMissingFile(error) || tree.file === null) throw error;
      // The tree's file went (the OS cleared its temp folder): list it again.
      this.forgetTree(tree);
      return this.search(place, changesetId, query, { limit, signal, onUpdate });
    }
    return best.take();
  }

  private async searchTree(place: RepositoryPlace, changesetId: number, tree: Tree, best: BestPaths, signal: AbortSignal | undefined, onUpdate: PathSearch['onUpdate']): Promise<void> {
    if (tree.file === null) {
      // A search that joins a listing from its first item matches as it goes; one that joins late missed the items
      // already read, so it reads the whole file once it is written.
      const fromTheStart = tree.listing === null || tree.listed === 0;
      if (fromTheStart) return this.matchWhileListing(place, changesetId, tree, best, signal, onUpdate);
      await untilListedOrStopped(tree.listing!, signal);
    }
    if (!signal?.aborted && tree.file !== null) await this.matchFile(tree.file, best, signal, onUpdate);
  }

  /** Lets a repository's trees go: its last window left it (`onRepositoryLeft`). A listing under way stops. */
  forget(repository: string): void {
    for (const tree of [...this.trees.values()]) if (tree.repository === repository) this.forgetTree(tree);
  }

  /** Deletes the trees sessions that crashed left: at start-up, never waiting for a first search. */
  removeLeftOvers(): Promise<void> {
    return this.folder.removeLeftOvers();
  }

  /** Stops every listing and deletes every tree, at once: the app is quitting. */
  dispose(): void {
    for (const tree of this.trees.values()) tree.abort.abort();
    this.trees.clear();
    this.folder.dispose();
  }

  /** The changeset's tree, made the last searched: the map holds the trees in the order they were last searched. */
  private treeOf(place: RepositoryPlace, changesetId: number): Tree {
    const key = treeKey(place.repository, changesetId);
    const tree = this.trees.get(key) ?? { key, repository: place.repository, file: null, listing: null, listeners: new Set(), listed: 0, abort: new AbortController() };
    this.trees.delete(key);
    this.trees.set(key, tree);
    return tree;
  }

  /** Matches the items as the tree's listing reads them, starting it when no search did. */
  private async matchWhileListing(place: RepositoryPlace, changesetId: number, tree: Tree, best: BestPaths, signal: AbortSignal | undefined, onUpdate: PathSearch['onUpdate']): Promise<void> {
    let sinceUpdate = 0;
    const listener = (item: ListedPath): void => {
      best.offer(item);
      if (++sinceUpdate < ITEMS_PER_UPDATE || !best.changed) return;
      sinceUpdate = 0;
      onUpdate?.(best.take(), 'server');
    };
    tree.listeners.add(listener);
    const stop = (): void => void tree.listeners.delete(listener);
    signal?.addEventListener('abort', stop, { once: true });
    try {
      tree.listing ??= this.startListing(place, changesetId, tree);
      await untilListedOrStopped(tree.listing, signal);
      if (best.changed && !signal?.aborted) onUpdate?.(best.take(), 'server');
    } finally {
      stop();
      signal?.removeEventListener('abort', stop);
    }
  }

  /** Reads the tree's file line by line into `best`, telling the best so far as they change. */
  private async matchFile(file: string, best: BestPaths, signal: AbortSignal | undefined, onUpdate: PathSearch['onUpdate']): Promise<void> {
    const lines = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
    let sinceUpdate = 0;
    try {
      for await (const line of lines) {
        if (signal?.aborted) break;
        const item = readListedPathLine(line);
        if (!item) continue;
        best.offer(item);
        if (++sinceUpdate < ITEMS_PER_UPDATE || !best.changed) continue;
        sinceUpdate = 0;
        onUpdate?.(best.take(), 'disk');
      }
    } finally {
      lines.close();
    }
    if (best.changed && !signal?.aborted) onUpdate?.(best.take(), 'disk');
  }

  /** Starts the tree's listing; its failure is the searches' awaiting it, never unhandled when all of them stopped. */
  private startListing(place: RepositoryPlace, changesetId: number, tree: Tree): Promise<string> {
    const listing = this.list(place, changesetId, tree);
    listing.catch(() => undefined);
    return listing;
  }

  /**
   * Lists the tree into its file: written as `<name>.partial` while the listing runs, renamed once it is whole, so a
   * listing that failed or was stopped leaves no tree a search would trust. The repository keeps the trees searched
   * last (`TREES_KEPT`).
   */
  private async list(place: RepositoryPlace, changesetId: number, tree: Tree): Promise<string> {
    const name = `${createHash('sha1').update(place.repository).digest('hex').slice(0, 16)}-${changesetId}`;
    const at = cmPlace(place);
    let partial: string | null = null;
    let writer: BatchedWriter | null = null;
    let file: string;
    try {
      const folder = await this.folder.path();
      partial = join(folder, `${name}.partial`);
      file = join(folder, `${name}.paths`);
      writer = new BatchedWriter(partial);
      const into = writer;
      await this.cm.executeRecords(
        repositoryPathsArgs(at.spec(`cs:${changesetId}`)),
        (fields) => {
          const item = readListedPath(fields);
          if (!item) return undefined;
          into.write(listedPathLine(item));
          tree.listed++;
          for (const listener of tree.listeners) listener(item);
          // Nothing is kept: the item is in the file, and in the searches' best results when it is one of them.
          return undefined;
        },
        { ...at.options, signal: tree.abort.signal },
      );
      writer.close();
      await rename(partial, file);
    } catch (error) {
      writer?.close();
      if (partial) await rm(partial, { force: true });
      // The next search lists it again.
      tree.listing = null;
      tree.listed = 0;
      throw error;
    }
    tree.file = file;
    this.keepLastSearchedTrees(tree.repository);
    return file;
  }

  /** Lets the repository's whole trees go but the `TREES_KEPT` searched last. */
  private keepLastSearchedTrees(repository: string): void {
    const whole = [...this.trees.values()].filter((tree) => tree.repository === repository && tree.file !== null);
    for (const tree of whole.slice(0, -TREES_KEPT)) this.forgetTree(tree);
  }

  /**
   * Stops the tree's listing and deletes its file. A file Windows still holds (an antivirus reading it) stays for the
   * session folder's deletion as the app quits, or the next session's.
   */
  private forgetTree(tree: Tree): void {
    if (this.trees.get(tree.key) === tree) this.trees.delete(tree.key);
    tree.abort.abort();
    if (!tree.file) return;
    try {
      rmSync(tree.file, { force: true });
    } catch {
      // Deleted with the session folder (`SessionFolder`).
    }
  }
}

function treeKey(repository: string, changesetId: number): string {
  return `${repository}#${changesetId}`;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/**
 * Waits for the tree's listing, unless the search is stopped first: then at once, the listing going on for the next
 * search. Fails as the listing does.
 */
function untilListedOrStopped(listing: Promise<string>, signal: AbortSignal | undefined): Promise<unknown> {
  if (!signal) return listing;
  if (signal.aborted) return Promise.resolve();
  return Promise.race([listing, new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))]);
}

/** Appends lines to a file in batches, synchronously: the listing's records can't wait for a write, and its memory stays a batch. */
class BatchedWriter {
  private readonly fd: number;
  private pending: string[] = [];
  private pendingLength = 0;
  private closed = false;

  constructor(path: string) {
    this.fd = openSync(path, 'w');
  }

  write(text: string): void {
    if (!text) return;
    this.pending.push(text);
    this.pendingLength += text.length;
    if (this.pendingLength >= WRITE_BATCH) this.flush();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.flush();
    closeSync(this.fd);
  }

  private flush(): void {
    if (this.pending.length === 0) return;
    writeSync(this.fd, this.pending.join(''));
    this.pending = [];
    this.pendingLength = 0;
  }
}
