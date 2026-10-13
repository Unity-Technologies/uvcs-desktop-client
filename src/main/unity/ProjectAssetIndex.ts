// A Unity project's assets by GUID (each `.meta` says its asset's on its second line, `guid: <32 hex>`) and by file
// name, read from the disk as lookups need them and kept while the workspace's watcher sees its changes. A project
// holds up to hundreds of thousands of assets, while a model's materials and textures are nearly always near it, so
// the index is read outward from the model: the subtree of its folder, then of each folder above it (as Unity's texture
// search prefers), then the rest of the project; a lookup stops reading at the first ring that answers it. Only a GUID
// or a name the project doesn't have reads it all, once: from then on it is known whole, and a miss misses at once.
// A GUID missing from all of it is looked for, last, in the registry packages Unity keeps in `Library/PackageCache`
// (a URP material a model is remapped to): read only on such a miss, as the cache holds thousands of package files.

import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import type { UnityProject } from './unityProject';

/**
 * The disk, as the index reads it: tests count what it reads. Paths are workspace-relative, `/`-separated. Only a
 * thing that isn't there is an answer (none, null); any other failure (a file another program holds, too many open)
 * rejects, and nothing of it is kept.
 */
export interface ProjectFiles {
  /** A folder's entries; none when it isn't there (or isn't a folder). */
  list(folder: string): Promise<{ name: string; isFolder: boolean }[]>;
  /** A file's first bytes as text; null when it isn't there. */
  head(path: string, length: number): Promise<string | null>;
}

interface Listing {
  folders: string[];
  /** The files' paths, `.meta` files apart. */
  files: string[];
  metas: string[];
  /** The GUIDs its `.meta` files gave, asset path by GUID: what forgetting it drops from `byGuid`. */
  guids: Map<string, string>;
  /** Whether every `.meta` of it was read: one that failed is read again when next needed. */
  guidsWhole: boolean;
}

/** Enough for `fileFormatVersion: 2` and the GUID line that follows, whatever the line ends. */
const META_HEAD_BYTES = 256;

/** Why a GUID found nowhere isn't known missing: no package cache to look in (`noLibrary`), or a read unfinished. */
export type GuidNotKnown = { notKnown: 'noLibrary' | 'unread' };
const UNREAD: GuidNotKnown = { notKnown: 'unread' };
type PackageCacheRead = 'whole' | GuidNotKnown['notKnown'];
const GUID_LINE = /^guid:\s*([0-9a-f]{32})\s*$/m;
/** Folders read at once while a ring is read, and `.meta` files per folder: the disk kept busy, its open files few. */
const FOLDERS_AT_ONCE = 8;
const HEADS_AT_ONCE = 16;

export class ProjectAssetIndex {
  /** By `folderKey`. */
  private readonly listings = new Map<string, Listing>();
  /** Reads in flight, by `folderKey`: two finds at once read a folder once. */
  private readonly listingReads = new Map<string, Promise<Listing | null>>();
  private readonly guidReads = new Map<string, Promise<boolean>>();
  private readonly byGuid = new Map<string, string>();
  /** Every file of the project by its name as the OS compares names: folded on Windows and macOS. */
  private readonly byName = new Map<string, Set<string>>();
  /** Read whole (the GUIDs of `Assets` and `Packages`, the names of `Assets`): a lookup that misses misses at once. */
  private wholeGuids = false;
  private wholeNames = false;
  /** `Library/PackageCache` read whole: a GUID missing from it too is missing. */
  private wholePackageCache = false;
  /** The package cache's read in flight: two finds at once read it once, and take its outcome. */
  private packageCacheRead: Promise<PackageCacheRead> | null = null;
  /**
   * What tells a read that a change made it stale: a read that settles after its folder was forgotten, or everything
   * cleared, keeps nothing (`isCurrent`), and a walk the project changed under never counts as whole.
   */
  private changes = 0;
  private clears = 0;
  /** By `folderKey`: how many times each folder was forgotten since the last `clear`. */
  private readonly forgotten = new Map<string, number>();

  constructor(
    readonly project: UnityProject,
    private readonly files: ProjectFiles,
    private readonly platform: NodeJS.Platform,
    /**
     * Whether a miss looks in the package cache: not for an index kept for one find alone (a watcher that doesn't see
     * every change), which would read all of it (tens of thousands of `.meta` files for URP) on every miss.
     */
    private readonly readsPackageCache = true,
  ) {}

  /**
   * The asset of a GUID: in the project's `Assets` or `Packages`, read outward from `near` (a folder), else in its
   * package cache. Null only when it's missing from all of them, every one read whole and current; whenever that can't
   * be told, why (`GuidNotKnown`): a material told missing that isn't is worse than one not told.
   */
  async pathOfGuid(guid: string, near: string): Promise<string | null | GuidNotKnown> {
    const wanted = guid.toLowerCase();
    for (let attempt = 0; attempt < 2; attempt++) {
      const found = this.byGuid.get(wanted) ?? (await this.notKnownYet(wanted, near));
      if (typeof found !== 'string') return found;
      // A folder changed while unwatched may still list a `.meta` that moved: what it says now decides (a read that
      // fails tells nothing, and the index stands).
      const head = await this.files.head(`${found}.meta`, META_HEAD_BYTES).catch(() => undefined);
      if (head === undefined || GUID_LINE.exec(head ?? '')?.[1] === wanted) return found;
      // Unity changes the package cache unseen (`noteChange`): a hit there gone stale makes all of it suspect.
      if (this.isUnder(found, this.packageCache())) this.forgetPackageCache();
      else this.forget(folderOf(found));
    }
    return UNREAD;
  }

  /** A GUID the index doesn't know: looked for in the project's rings, then in its package cache. */
  private async notKnownYet(wanted: string, near: string): Promise<string | null | GuidNotKnown> {
    const inProject = this.wholeGuids ? null : await this.inRings(near, () => this.byGuid.get(wanted) ?? null);
    if (typeof inProject === 'string') return inProject;
    const inCache = await this.inPackageCache(wanted);
    if (typeof inCache === 'string') return inCache;
    // The package cache's reason first: no `Library` is what a person can act on.
    return inCache ?? (inProject === null ? null : UNREAD);
  }

  /**
   * The files of `name` in the project's `Assets`, sorted: those under the first of `rings` (the folders Unity's
   * texture search climbs, the model's first) that has any, else anywhere in `Assets`.
   */
  async pathsNamed(name: string, rings: readonly string[]): Promise<string[]> {
    const key = this.comparable(name);
    const within = (folder: string) => [...(this.byName.get(key) ?? [])].filter((path) => this.isUnder(path, folder)).sort();
    if (!this.wholeNames) {
      for (const ring of rings) {
        await this.readSubtree(ring, false);
        const found = within(ring);
        if (found.length > 0) return found;
      }
      const changes = this.changes;
      const whole = await this.readSubtree(this.project.assets, false);
      this.wholeNames = whole && this.changes === changes;
    }
    for (const ring of rings) {
      const found = within(ring);
      if (found.length > 0) return found;
    }
    return within(this.project.assets);
  }

  /**
   * What the watcher saw: the folders changed are read again when next needed; a change anywhere, everything. The
   * watcher doesn't see `Library` (`ignore.conf` hides it); Unity rewrites `Packages/manifest.json` or
   * `packages-lock.json` as it changes the packages it caches, so a change in `Packages` itself drops the package cache.
   */
  noteChange(change: WorkspaceChange): void {
    if (change.folders === null) return this.clear();
    for (const folder of change.folders) this.forget(folder);
    if (change.folders.some((folder) => this.folderKey(folder) === this.folderKey(joined(this.project.root, 'Packages')))) this.forgetPackageCache();
  }

  /**
   * Drops what was read of the project, keeping the package cache: the watcher never sees it, so a change it saw says
   * nothing of it (Unity's own changes there are caught by `packageCacheUnchanged` and a hit's `.meta` check).
   */
  clear(): void {
    const cache = this.folderKey(this.packageCache());
    const keptCache = [...this.listings].filter(([key, listing]) => isUnder(key, cache) && listing.guidsWhole);
    const wholePackageCache = this.wholePackageCache && keptCache.length === [...this.listings.keys()].filter((key) => isUnder(key, cache)).length;
    this.listings.clear();
    this.listingReads.clear();
    this.guidReads.clear();
    this.byGuid.clear();
    this.byName.clear();
    this.forgotten.clear();
    this.packageCacheRead = null;
    this.clears++;
    this.changes++;
    this.wholeGuids = this.wholeNames = false;
    for (const [key, listing] of keptCache) {
      this.listings.set(key, listing);
      for (const [guid, path] of listing.guids) this.byGuid.set(guid, path);
    }
    this.wholePackageCache = wholePackageCache;
  }

  /**
   * A GUID in the registry packages Unity caches (`Library/PackageCache/<package>@<version>`), read whole on the first
   * GUID the rest of the project lacks; without a package there, or a read unfinished, nothing tells it's missing.
   */
  private async inPackageCache(guid: string): Promise<string | null | GuidNotKnown> {
    if (!this.readsPackageCache) return UNREAD;
    if (this.wholePackageCache && !(await this.packageCacheUnchanged())) this.forgetPackageCache();
    if (!this.wholePackageCache) {
      let reading = this.packageCacheRead;
      if (!reading) {
        const started: Promise<PackageCacheRead> = this.readPackageCache().finally(() => {
          if (this.packageCacheRead === started) this.packageCacheRead = null;
        });
        this.packageCacheRead = reading = started;
      }
      const read = await reading;
      if (read !== 'whole') return { notKnown: read };
      // Another find may have dropped the cache meanwhile (a stale hit): what's left can't tell a GUID missing.
      if (!this.wholePackageCache) return UNREAD;
    }
    return this.byGuid.get(guid) ?? null;
  }

  /**
   * Reads the package cache's GUIDs: `whole` once read whole with no change meanwhile; `noLibrary` without a package
   * in it (no `Library`, or one Unity hasn't resolved packages into on this machine: listed again on the next miss).
   */
  private async readPackageCache(): Promise<PackageCacheRead> {
    const changes = this.changes;
    const whole = await this.readSubtree(this.packageCache(), true);
    const top = this.listings.get(this.folderKey(this.packageCache()));
    if (whole && top !== undefined && top.folders.length === 0) return 'noLibrary';
    this.wholePackageCache = whole && this.changes === changes;
    return this.wholePackageCache ? 'whole' : 'unread';
  }

  /**
   * Whether the package cache still holds the packages it was read with: Unity adds, replaces (an upgrade: `@17.0.3`
   * goes, `@17.0.4` comes) and removes them unseen by the watcher, so a miss over a cache read whole lists its top
   * again, once, before telling the GUID missing.
   */
  private async packageCacheUnchanged(): Promise<boolean> {
    const known = this.listings.get(this.folderKey(this.packageCache()));
    const entries = await this.files.list(this.packageCache()).catch(() => null);
    if (!known || entries === null) return false;
    const names = (paths: string[]) => paths.map(fileNameOf);
    const before = [...names(known.folders), ...names(known.files), ...names(known.metas)].sort();
    const now = entries.map((entry) => entry.name).filter(isAsset).sort();
    return before.length === now.length && before.every((name, i) => name === now[i]);
  }

  private packageCache(): string {
    return joined(this.project.root, 'Library/PackageCache');
  }

  /** Drops every folder of the package cache read: it is read again on the next miss. */
  private forgetPackageCache(): void {
    const cache = this.folderKey(this.packageCache());
    for (const key of [...this.listings.keys()]) if (isUnder(key, cache)) this.forget(key);
    this.forget(cache);
    this.packageCacheRead = null;
    this.wholePackageCache = false;
  }

  /**
   * Reads the GUIDs ring after ring around `near` until `answer` has one: the subtree of each folder from `near` up to
   * `Assets`, then the project's packages. Null only for a GUID none has, read whole and current; else undefined.
   */
  private async inRings(near: string, answer: () => string | null): Promise<string | null | GuidNotKnown> {
    const changes = this.changes;
    for (const folder of foldersUp(this.folderKey(near), this.folderKey(this.project.assets))) {
      const known = answer();
      if (known !== null) return known;
      await this.readSubtree(folder, true);
    }
    let whole = true;
    for (const folder of this.roots()) {
      const known = answer();
      if (known !== null) return known;
      whole = (await this.readSubtree(folder, true)) && whole;
    }
    this.wholeGuids = whole && this.changes === changes;
    return answer() ?? (this.wholeGuids ? null : UNREAD);
  }

  /** `Assets`, and `Packages` where the project's own packages are (a GUID may be one of theirs). */
  private roots(): string[] {
    return [this.project.assets, joined(this.project.root, 'Packages')];
  }

  /** Lists every folder of the subtree, and reads its GUIDs when asked; false when a read failed (nothing kept of it). */
  private async readSubtree(top: string, guids: boolean): Promise<boolean> {
    const pending = [top];
    let whole = true;
    const read = async (folder: string): Promise<void> => {
      const listing = await this.listingOf(folder);
      if (!listing) return void (whole = false);
      if (guids && !listing.guidsWhole && !(await this.guidsOf(folder, listing))) whole = false;
      pending.push(...listing.folders);
    };
    while (pending.length > 0) await Promise.all(pending.splice(0, FOLDERS_AT_ONCE).map(read));
    return whole;
  }

  /** The folder's listing, read once however many finds ask at once; null when the read failed. */
  private listingOf(folder: string): Promise<Listing | null> {
    const key = this.folderKey(folder);
    const known = this.listings.get(key);
    if (known) return Promise.resolve(known);
    let reading = this.listingReads.get(key);
    if (!reading) {
      const started: Promise<Listing | null> = this.list(folder, key).finally(() => {
        if (this.listingReads.get(key) === started) this.listingReads.delete(key);
      });
      this.listingReads.set(key, (reading = started));
    }
    return reading;
  }

  /** The folder's listing as the disk gives it; kept only when no change made it stale while it was read. */
  private async list(folder: string, key: string): Promise<Listing | null> {
    const read = this.readStamp(key);
    const entries = await this.files.list(folder).catch(() => null);
    if (!entries) return null;
    const listing: Listing = { folders: [], files: [], metas: [], guids: new Map(), guidsWhole: false };
    for (const { name, isFolder } of entries.filter((entry) => isAsset(entry.name))) {
      const path = joined(folder, name);
      if (isFolder) listing.folders.push(path);
      else if (name.toLowerCase().endsWith('.meta')) listing.metas.push(path);
      else listing.files.push(path);
    }
    if (this.readStamp(key) !== read) return listing;
    this.listings.set(key, listing);
    for (const path of listing.files) {
      const name = this.comparable(fileNameOf(path));
      this.byName.set(name, (this.byName.get(name) ?? new Set()).add(path));
    }
    return listing;
  }

  /** Reads the GUIDs of a folder's `.meta` files once however many finds ask; false when a read failed. */
  private guidsOf(folder: string, listing: Listing): Promise<boolean> {
    const key = this.folderKey(folder);
    let reading = this.guidReads.get(key);
    if (!reading) {
      const started: Promise<boolean> = this.readGuids(key, listing).finally(() => {
        if (this.guidReads.get(key) === started) this.guidReads.delete(key);
      });
      this.guidReads.set(key, (reading = started));
    }
    return reading;
  }

  /** Reads the GUIDs of the listing's `.meta` files; kept only while the listing is still the folder's. */
  private async readGuids(key: string, listing: Listing): Promise<boolean> {
    const guids = new Map<string, string>();
    let whole = true;
    for (let at = 0; at < listing.metas.length; at += HEADS_AT_ONCE) {
      await Promise.all(
        listing.metas.slice(at, at + HEADS_AT_ONCE).map(async (meta) => {
          const head = await this.files.head(meta, META_HEAD_BYTES).catch(() => undefined);
          if (head === undefined) return void (whole = false);
          const guid = GUID_LINE.exec(head ?? '')?.[1];
          if (guid) guids.set(guid, meta.slice(0, -'.meta'.length));
        }),
      );
    }
    if (this.listings.get(key) !== listing) return whole;
    for (const [guid, path] of guids) {
      this.byGuid.set(guid, path);
      listing.guids.set(guid, path);
    }
    // A `.meta` that couldn't be read is read again next time: the folder's GUIDs aren't known whole.
    listing.guidsWhole = whole;
    return whole;
  }

  /** Drops what a folder's listing told: it is listed again when a lookup next reaches it. */
  private forget(folder: string): void {
    const key = this.folderKey(folder);
    const listing = this.listings.get(key);
    this.forgotten.set(key, (this.forgotten.get(key) ?? 0) + 1);
    this.changes++;
    this.listingReads.delete(key);
    this.guidReads.delete(key);
    this.wholeGuids = this.wholeNames = false;
    if (!listing) return;
    this.listings.delete(key);
    for (const path of listing.files) this.byName.get(this.comparable(fileNameOf(path)))?.delete(path);
    // Only the folder's own GUIDs, never a scan of the whole index: a batch of changes forgets many folders at once.
    for (const [guid, path] of listing.guids) if (this.byGuid.get(guid) === path) this.byGuid.delete(guid);
  }

  /** Changes when the folder is forgotten or everything is cleared: a read that started before keeps nothing. */
  private readStamp(key: string): string {
    return `${this.clears}:${this.forgotten.get(key) ?? 0}`;
  }

  private comparable(name: string): string {
    return this.platform === 'linux' ? name : name.normalize('NFC').toLowerCase();
  }

  /**
   * A folder as the index keys it: macOS reports a changed folder decomposed (NFD) while a model's path and a folder's
   * listing may be composed (NFC), and finds a file by either. The paths returned keep the listing's own form.
   */
  private folderKey(folder: string): string {
    return this.platform === 'darwin' ? folder.normalize('NFC') : folder;
  }

  private isUnder(path: string, folder: string): boolean {
    return isUnder(this.folderKey(path), this.folderKey(folder));
  }
}

/** Unity leaves out hidden files and folders, and those ending in `~` (`Documentation~`). */
function isAsset(name: string): boolean {
  return !name.startsWith('.') && !name.endsWith('~');
}

/** `near` and each folder above it, up to `top` (the project's `Assets`): never the project's own folder, whose `Library` holds Unity's caches. */
function foldersUp(near: string, top: string): string[] {
  const folders: string[] = [];
  for (let folder = near; isUnder(folder, top); folder = folderOf(folder)) {
    folders.push(folder);
    if (folder === top) break;
  }
  return folders;
}

function folderOf(path: string): string {
  const end = path.lastIndexOf('/');
  return end === -1 ? '' : path.slice(0, end);
}

function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function joined(folder: string, name: string): string {
  return folder === '' ? name : `${folder}/${name}`;
}

function isUnder(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}
