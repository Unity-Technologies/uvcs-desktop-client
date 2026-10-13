// The repository's tree at a version's point (a changeset, a branch's head), as the Materials look looks a model's
// materials and textures up in it (docs/features/model-diff.md, "Materials"): the same Unity search as on the disk,
// over what `cm ls --tree -R` lists there. A folder is listed with everything below it, once per point: the model's
// folder first, which answers most lookups (textures beside the model, its own `Textures`), and the whole project only
// when a lookup reaches past it. A file's bytes are its revision's (`RevisionDownloads`): the disk's where it has the
// same content, else downloaded. The side before a change is the tree after it with the change undone (`AssetsBefore`).

import type { AssetsBefore, FoundFile } from '@shared/domain/unityAssets';
import type { ListedItem } from '../cm/treeListing';
import type { ProjectFiles } from './ProjectAssetIndex';
import type { RevisionFile } from './RevisionDownloads';

/** A file or folder of the tree at the point, after the side before's changes; a size of -1 and no hash where not known. */
type TreeItem = Pick<ListedItem, 'path' | 'isFolder' | 'size' | 'revision'> & { hash: string | null };

/** A folder listed with everything below it: its items by comparable path, and each folder's children. */
interface Listing {
  items: Map<string, TreeItem>;
  children: Map<string, TreeItem[]>;
}

export interface RepositoryTreeSource {
  /**
   * The folder and everything below it at the point (`cm ls --tree -R`); null where the tree hasn't the folder. `near`
   * for the model's folder, quick to list; `wide` for its project's, which may take a while.
   */
  list(folder: string, scope: 'near' | 'wide'): Promise<ListedItem[] | null>;
  /** A revision's bytes, downloaded only while `mayDownload` says so. */
  read(file: RevisionFile, mayDownload: () => boolean): Promise<Buffer>;
}

/** What one point's lookups may download of `.meta` files to read GUIDs: a GUID's search stops short past it. */
export const MAX_META_DOWNLOADS = 2000;

export class RepositoryAssetTree {
  /** Listings by their folder's comparable path, under way or done. */
  private readonly listings = new Map<string, Promise<Listing | null>>();
  private metaDownloads = 0;

  constructor(
    private readonly source: RepositoryTreeSource,
    private readonly before: AssetsBefore | undefined,
    private readonly platform: NodeJS.Platform,
  ) {}

  /**
   * The tree as a model's lookups read it: folders under `near` (the model's) from its listing, any other from
   * `wide`'s (its project's, or the model's folder again outside one). `local` is the disk, for what no repository holds
   * (the project's `Library`, where Unity keeps its package cache).
   */
  view(near: string, wide: string, local: { folder: string; files: ProjectFiles } | null): AssetTreeView {
    const listingOf = async (path: string): Promise<Listing | null> => {
      for (const [top, listing] of this.listings) if (this.isUnder(path, top)) return listing;
      return this.isUnder(path, this.comparable(near)) ? this.listing(near, 'near') : this.listing(wide, 'wide');
    };
    const itemAt = async (path: string): Promise<TreeItem | null> => (await listingOf(this.comparable(path)))?.items.get(this.comparable(path)) ?? null;
    const isLocal = (path: string) => local !== null && this.isUnder(this.comparable(path), this.comparable(local.folder));
    return {
      file: async (path) => {
        const item = await itemAt(path);
        return item && !item.isFolder ? { path: item.path, size: item.size, stored: 'repository', revision: item.revision, hash: item.hash } : null;
      },
      files: {
        list: async (folder) => {
          if (isLocal(folder)) return local!.files.list(folder);
          const children = (await listingOf(this.comparable(folder)))?.children.get(this.comparable(folder)) ?? [];
          return children.map((child) => ({ name: child.path.slice(child.path.lastIndexOf('/') + 1), isFolder: child.isFolder }));
        },
        head: async (path, length) => {
          if (isLocal(path)) return local!.files.head(path, length);
          const item = await itemAt(path);
          if (!item || item.isFolder) return null;
          const bytes = await this.source.read(revisionFileOf(item), () => this.metaDownloads++ < MAX_META_DOWNLOADS);
          return bytes.toString('utf8', 0, Math.min(length, bytes.length));
        },
      },
    };
  }

  /** A folder's listing, asked once however many lookups need it at once. */
  private listing(folder: string, scope: 'near' | 'wide'): Promise<Listing | null> {
    const key = this.comparable(folder);
    const known = this.listings.get(key);
    if (known) return known;
    const listing = this.source.list(folder, scope).then(
      (items) => (items ? this.listingOf(folder, items) : null),
      (error: unknown) => Promise.reject(new TreeListingError(folder, error)),
    );
    // A listing that failed (the server) is asked again by the next lookup, unless another took its place meanwhile.
    listing.catch(() => this.listings.get(key) === listing && this.listings.delete(key));
    this.listings.set(key, listing);
    return listing;
  }

  /** The listed items as they are on the side asked: the tree's, or with the change undone (`before`). */
  private listingOf(top: string, listed: ListedItem[]): Listing {
    const items = new Map<string, TreeItem>();
    for (const item of listed) {
      const { path, isFolder, size, revision, hash } = item;
      if (this.before?.kind === 'changeset' && !isFolder && item.changeset === this.before.changeset) {
        // Made by the changeset: before it, its parent revision, or nothing where it added the file.
        if (item.parentRevisionId >= 0) items.set(this.comparable(path), { path, isFolder, size: -1, revision: { ...revision, revisionId: item.parentRevisionId }, hash: null });
        continue;
      }
      items.set(this.comparable(path), { path, isFolder, size, revision, hash });
    }
    if (this.before?.kind === 'changes') {
      for (const change of this.before.changes) {
        const key = this.comparable(change.path);
        if (!this.isUnder(key, this.comparable(top)) || key === this.comparable(top)) continue;
        if (change.revision) items.set(key, { path: change.path, isFolder: false, size: -1, revision: change.revision, hash: null });
        else items.delete(key);
      }
    }
    return { items, children: this.childrenOf(top, items) };
  }

  /** Each folder's children, a folder the side before's changes need (a file the diff deleted) made where missing. */
  private childrenOf(top: string, items: Map<string, TreeItem>): Map<string, TreeItem[]> {
    const children = new Map<string, TreeItem[]>();
    const topKey = this.comparable(top);
    const add = (item: TreeItem): void => {
      const key = this.comparable(item.path);
      if (key === topKey) return;
      const parent = item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : '';
      const parentKey = this.comparable(parent);
      const siblings = children.get(parentKey);
      if (siblings) return void siblings.push(item);
      children.set(parentKey, [item]);
      if (parentKey !== topKey && !items.has(parentKey)) add({ path: parent, isFolder: true, size: 0, revision: item.revision, hash: null });
    };
    for (const item of items.values()) add(item);
    return children;
  }

  /** A path as the disk compares it: case aside on macOS and Windows, in one Unicode form. */
  private comparable(path: string): string {
    const normalized = path.normalize('NFC');
    return this.platform === 'linux' ? normalized : normalized.toLowerCase();
  }

  /** Whether a comparable path is the comparable folder or below it (`''` is the root). */
  private isUnder(path: string, folder: string): boolean {
    return folder === '' || path === folder || path.startsWith(`${folder}/`);
  }
}

/**
 * The tree at the point couldn't be listed (the server, a branch gone): no answer, never "not there". The find fails
 * with it, to be asked again.
 */
export class TreeListingError extends Error {
  constructor(folder: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : `/${folder} couldn't be listed`, { cause });
    this.name = 'TreeListingError';
  }
}

/** What the Unity search reads of a tree: a file at a path, and the folders and `.meta` heads its index reads. */
export interface AssetTreeView {
  /** The file at a workspace-relative path; null where there is none. Rejects where it can't tell. */
  file(path: string): Promise<FoundFile | null>;
  files: ProjectFiles;
}

function revisionFileOf(item: TreeItem): RevisionFile {
  return { path: item.path, revision: item.revision, hash: item.hash, size: item.size };
}
