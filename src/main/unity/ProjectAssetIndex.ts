// A Unity project's assets by GUID (each `.meta` says its asset's on its second line, `guid: <32 hex>`) and by file
// name, read from the disk as lookups need them and kept while the workspace's watcher sees its changes. A project
// holds up to hundreds of thousands of assets, while a model's materials and textures are nearly always near it, so
// the index is read outward from the model: the subtree of its folder, then of each folder above it (as Unity's texture
// search prefers), then the rest of the project; a lookup stops reading at the first ring that answers it. Only a GUID
// or a name the project doesn't have reads it all, once: from then on it is known whole.

import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import type { UnityProject } from './unityProject';

/** The disk, as the index reads it: tests count what it reads. Paths are workspace-relative, `/`-separated. */
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
  /** The GUIDs its `.meta` files give, once read: asset path by GUID. */
  guids: Map<string, string> | null;
}

/** Enough for `fileFormatVersion: 2` and the GUID line that follows, whatever the line ends. */
const META_HEAD_BYTES = 256;
const GUID_LINE = /^guid:\s*([0-9a-f]{32})\s*$/m;
/** Folders read at once while a ring is read, and `.meta` files per folder: the disk's threads, kept busy. */
const FOLDERS_AT_ONCE = 8;
const HEADS_AT_ONCE = 32;

export class ProjectAssetIndex {
  private readonly listings = new Map<string, Listing>();
  private readonly byGuid = new Map<string, string>();
  /** Every file of the project by its name as the OS compares names: folded on Windows and macOS. */
  private readonly byName = new Map<string, Set<string>>();

  constructor(
    readonly project: UnityProject,
    private readonly files: ProjectFiles,
    private readonly platform: NodeJS.Platform,
  ) {}

  /** The asset of a GUID: in the project's `Assets` or `Packages`, read outward from `near` (a folder). */
  async pathOfGuid(guid: string, near: string): Promise<string | null> {
    const wanted = guid.toLowerCase();
    for (let attempt = 0; attempt < 2; attempt++) {
      const found = await this.inRings(near, () => this.byGuid.get(wanted) ?? null);
      if (found === null) return null;
      // A folder changed while unwatched may still list a `.meta` that moved: what it says now decides.
      if (GUID_LINE.exec((await this.files.head(`${found}.meta`, META_HEAD_BYTES)) ?? '')?.[1] === wanted) return found;
      this.forget(folderOf(found));
    }
    return null;
  }

  /**
   * The files of `name` in the project's `Assets`, sorted: those under the first of `rings` (the folders Unity's
   * texture search climbs, the model's first) that has any, else anywhere in `Assets`.
   */
  async pathsNamed(name: string, rings: readonly string[]): Promise<string[]> {
    const key = this.comparable(name);
    const within = (folder: string) => [...(this.byName.get(key) ?? [])].filter((path) => isUnder(path, folder)).sort();
    for (const ring of rings) {
      await this.readSubtree(ring, false);
      const found = within(ring);
      if (found.length > 0) return found;
    }
    await this.readSubtree(this.project.assets, false);
    return within(this.project.assets);
  }

  /** What the watcher saw: the folders changed are read again when next needed; a change anywhere, everything. */
  noteChange(change: WorkspaceChange): void {
    if (change.folders === null) return this.clear();
    for (const folder of change.folders) this.forget(folder);
  }

  clear(): void {
    this.listings.clear();
    this.byGuid.clear();
    this.byName.clear();
  }

  /**
   * Reads the GUIDs ring after ring around `near` until `answer` has one: the subtree of each folder from `near` up to
   * `Assets`, then the project's packages.
   */
  private async inRings(near: string, answer: () => string | null): Promise<string | null> {
    for (const folder of [...foldersUp(near, this.project.assets), ...this.roots()]) {
      const known = answer();
      if (known !== null) return known;
      await this.readSubtree(folder, true);
    }
    return answer();
  }

  /** `Assets`, and `Packages` where the project's own packages are (a GUID may be one of theirs). */
  private roots(): string[] {
    return [this.project.assets, joined(this.project.root, 'Packages')];
  }

  /** Lists every folder of the subtree not listed yet, and reads its GUIDs when asked. */
  private async readSubtree(top: string, guids: boolean): Promise<void> {
    const pending = [top];
    const read = async (folder: string): Promise<void> => {
      const listing = this.listings.get(folder) ?? (await this.list(folder));
      if (guids && listing.guids === null) await this.readGuids(listing);
      pending.push(...listing.folders);
    };
    while (pending.length > 0) await Promise.all(pending.splice(0, FOLDERS_AT_ONCE).map(read));
  }

  private async list(folder: string): Promise<Listing> {
    const entries = (await this.files.list(folder)).filter(({ name }) => isAsset(name));
    const listing: Listing = { folders: [], files: [], metas: [], guids: null };
    for (const { name, isFolder } of entries) {
      const path = joined(folder, name);
      if (isFolder) listing.folders.push(path);
      else if (name.toLowerCase().endsWith('.meta')) listing.metas.push(path);
      else listing.files.push(path);
    }
    this.listings.set(folder, listing);
    for (const path of listing.files) {
      const key = this.comparable(path.slice(path.lastIndexOf('/') + 1));
      this.byName.set(key, (this.byName.get(key) ?? new Set()).add(path));
    }
    return listing;
  }

  private async readGuids(listing: Listing): Promise<void> {
    const guids = new Map<string, string>();
    for (let at = 0; at < listing.metas.length; at += HEADS_AT_ONCE) {
      await Promise.all(
        listing.metas.slice(at, at + HEADS_AT_ONCE).map(async (meta) => {
          const guid = GUID_LINE.exec((await this.files.head(meta, META_HEAD_BYTES)) ?? '')?.[1];
          if (guid) guids.set(guid, meta.slice(0, -'.meta'.length));
        }),
      );
    }
    listing.guids = guids;
    for (const [guid, path] of guids) this.byGuid.set(guid, path);
  }

  /** Drops what a folder's listing told: it is listed again when a lookup next reaches it. */
  private forget(folder: string): void {
    const listing = this.listings.get(folder);
    if (!listing) return;
    this.listings.delete(folder);
    for (const path of listing.files) this.byName.get(this.comparable(path.slice(path.lastIndexOf('/') + 1)))?.delete(path);
    for (const [guid, path] of listing.guids ?? []) if (this.byGuid.get(guid) === path) this.byGuid.delete(guid);
  }

  private comparable(name: string): string {
    return this.platform === 'linux' ? name : name.normalize('NFC').toLowerCase();
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

function joined(folder: string, name: string): string {
  return folder === '' ? name : `${folder}/${name}`;
}

function isUnder(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}
