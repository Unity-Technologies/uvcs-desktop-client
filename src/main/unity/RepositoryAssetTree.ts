// The repository's tree at a point (a changeset, a branch's head), as the Materials look looks a model's materials and
// textures up in it (docs/features/model-diff.md, "Materials"): the same Unity search as on the disk, over what
// `cm ls --tree` lists there. The listings are the point's, shared by every read there, both sides of a diff
// included; each side sees them through its own view, with its change undone (`AssetsBefore`). A folder is listed with
// everything below it once per point: the model's folder first, which answers most lookups (textures beside the model,
// its own `Textures`), and the whole project only when a lookup reaches past it. A model's files beside it are found in
// its folder's listing alone (`fileBeside`). A file's bytes are its revision's (`RevisionDownloads`): the disk's where
// it has the same content, else downloaded.

import type { AssetsBefore, FoundFile } from '@shared/domain/unityAssets';
import type { ListedItem } from '../cm/treeListing';
import type { ProjectFiles } from './ProjectAssetIndex';
import type { RevisionFile } from './RevisionDownloads';

/** A file or folder of the tree at the point, after the side before's changes; a size of -1 and no hash where not known. */
type TreeItem = Pick<ListedItem, 'path' | 'isFolder' | 'size' | 'revision'> & { hash: string | null };

/** A folder listed with everything below it, as one side sees it: its items by comparable path, each folder's children. */
interface Listing {
  items: Map<string, TreeItem>;
  children: Map<string, TreeItem[]>;
}

export interface RepositoryTreeSource {
  /**
   * The folder at the point, with everything below it (`recursive`: `cm ls --tree -R`, which may take a while) or its
   * children alone; null where the tree hasn't the folder.
   */
  list(folder: string, recursive: boolean): Promise<ListedItem[] | null>;
  /** A revision's bytes, downloaded only while `mayDownload` says so. */
  read(file: RevisionFile, mayDownload: () => boolean): Promise<Buffer>;
}

/** What one point's lookups may download of `.meta` files to read GUIDs: a GUID's search stops short past it. */
export const MAX_META_DOWNLOADS = 2000;

export class RepositoryAssetTree {
  /**
   * The point's listings as `cm` gave them, by kind and comparable folder (`R:` with everything below it, `S:` its
   * children), with the folder as it was asked: a listing is asked again in the tree's own spelling, never the
   * comparable one (lowercased on macOS and Windows).
   */
  private readonly listed = new Map<string, { folder: string; items: Promise<ListedItem[] | null> }>();
  private metaDownloads = 0;

  constructor(
    private readonly source: RepositoryTreeSource,
    private readonly platform: NodeJS.Platform,
  ) {}

  /**
   * The tree as one side's lookups read it, with its change undone (`before`): folders under `near` (the model's) from
   * its listing, any other from `wide`'s (its project's; the same folder where the model's would be as large). `local`
   * is the disk, for what no repository holds (the project's `Library`, where Unity keeps its package cache).
   */
  view(near: string, wide: string, local: { folder: string; files: ProjectFiles } | null, before: AssetsBefore | undefined): AssetTreeView {
    const seen = new Map<string, Promise<Listing | null>>();
    const listingOf = (path: string): Promise<Listing | null> => {
      const top = this.coveringTop(path) ?? (this.isUnder(path, this.comparable(near)) ? near : wide);
      const key = this.comparable(top);
      let listing = seen.get(key);
      if (!listing) {
        const derived = this.recursive(top).then((items) => items && this.sideOf(top, items, before));
        // A failure isn't kept: the view lives on in a project's index, whose next lookup lists it again.
        derived.catch(() => seen.get(key) === derived && seen.delete(key));
        seen.set(key, (listing = derived));
      }
      return listing;
    };
    const itemAt = async (path: string): Promise<TreeItem | null> => (await listingOf(this.comparable(path)))?.items.get(this.comparable(path)) ?? null;
    const isLocal = (path: string) => local !== null && this.isUnder(this.comparable(path), this.comparable(local.folder));
    // The `.meta` heads of a folder are read together, so the downloads they need go in one batch, not 16 at a time.
    const heads = new Map<string, Promise<string | null>>();
    const headOf = (item: TreeItem): Promise<string | null> => {
      const key = this.comparable(item.path);
      let head = heads.get(key);
      if (!head) {
        head = this.source.read(revisionFileOf(item), () => this.metaDownloads++ < MAX_META_DOWNLOADS).then((bytes) => bytes.toString('utf8', 0, Math.min(META_HEAD_BYTES, bytes.length)));
        // Its error is its reader's, if one asks.
        head.catch(() => heads.get(key) === head && heads.delete(key));
        heads.set(key, head);
      }
      return head;
    };
    return {
      file: async (path) => fileOf(await itemAt(path)),
      files: {
        list: async (folder) => {
          if (isLocal(folder)) return local!.files.list(folder);
          const children = (await listingOf(this.comparable(folder)))?.children.get(this.comparable(folder)) ?? [];
          return children.map((child) => ({ name: child.path.slice(child.path.lastIndexOf('/') + 1), isFolder: child.isFolder }));
        },
        head: async (path, length) => {
          if (isLocal(path)) return local!.files.head(path, length);
          const listing = await listingOf(this.comparable(path));
          const item = listing?.items.get(this.comparable(path));
          if (!listing || !item || item.isFolder) return null;
          const folder = this.comparable(folderOf(item.path));
          for (const sibling of listing.children.get(folder) ?? []) if (!sibling.isFolder && /\.meta$/i.test(sibling.path)) void headOf(sibling).catch(() => undefined);
          return (await headOf(item))?.slice(0, length) ?? null;
        },
      },
    };
  }

  /**
   * A file beside a model at the point (its `.meta`, a glTF's `.bin`): from a listing below which it already is, else
   * from its folder's children alone, never a whole subtree for one file. Null where the tree hasn't it.
   */
  async fileBeside(path: string): Promise<FoundFile | null> {
    const folder = folderOf(path);
    const top = this.coveringTop(this.comparable(folder));
    const items = top === null ? await this.shallow(folder) : await this.recursive(top);
    return fileOf(items?.find((item) => this.comparable(item.path) === this.comparable(path)) ?? null);
  }

  /** The top of a listing with everything below it, asked already, that holds the (comparable) path. */
  private coveringTop(path: string): string | null {
    for (const [key, { folder }] of this.listed) if (key.startsWith('R:') && this.isUnder(path, key.slice(2))) return folder;
    return null;
  }

  private recursive(folder: string): Promise<ListedItem[] | null> {
    return this.listing(`R:${this.comparable(folder)}`, folder, true);
  }

  private shallow(folder: string): Promise<ListedItem[] | null> {
    return this.listing(`S:${this.comparable(folder)}`, folder, false);
  }

  /** A listing, asked once however many reads need it at once. */
  private listing(key: string, folder: string, recursive: boolean): Promise<ListedItem[] | null> {
    const known = this.listed.get(key);
    if (known) return known.items;
    const items = this.source.list(folder, recursive).catch((error: unknown) => Promise.reject(new TreeListingError(folder, error)));
    const entry = { folder, items };
    // A listing that failed (the server) is asked again by the next read, unless another took its place meanwhile.
    items.catch(() => this.listed.get(key) === entry && this.listed.delete(key));
    this.listed.set(key, entry);
    return items;
  }

  /** The listed items as one side sees them: the tree's, or with the change undone (`before`). */
  private sideOf(top: string, listed: ListedItem[], before: AssetsBefore | undefined): Listing {
    const items = new Map<string, TreeItem>();
    for (const item of listed) {
      const { path, isFolder, size, revision, hash } = item;
      if (before?.kind === 'changeset' && !isFolder && item.changeset === before.changeset && revision.repository === before.repository) {
        // Made by the changeset: before it, its parent revision, or nothing where it added the file.
        if (item.parentRevisionId >= 0) items.set(this.comparable(path), { path, isFolder, size: -1, revision: { ...revision, revisionId: item.parentRevisionId }, hash: null });
        continue;
      }
      items.set(this.comparable(path), { path, isFolder, size, revision, hash });
    }
    if (before?.kind === 'changes') {
      for (const change of before.changes) {
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
      const parentKey = this.comparable(folderOf(item.path));
      const siblings = children.get(parentKey);
      if (siblings) return void siblings.push(item);
      children.set(parentKey, [item]);
      if (parentKey !== topKey && !items.has(parentKey)) add({ path: folderOf(item.path), isFolder: true, size: 0, revision: item.revision, hash: null });
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

/** Enough of a `.meta` for `fileFormatVersion: 2` and the GUID line that follows (`ProjectAssetIndex` asks as much). */
const META_HEAD_BYTES = 256;

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

function fileOf(item: TreeItem | null | undefined): FoundFile | null {
  return item && !item.isFolder ? { path: item.path, size: item.size, stored: 'repository', revision: item.revision, hash: item.hash } : null;
}

function folderOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function revisionFileOf(item: TreeItem): RevisionFile {
  return { path: item.path, revision: item.revision, hash: item.hash, size: item.size };
}
