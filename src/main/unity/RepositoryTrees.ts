// The repository's trees at the points a model viewer reads (a changeset, a branch's head), each listed once while
// kept and shared by every read there (docs/features/model-diff.md, "Beside the model" and "Materials"): the Materials
// look's lookups (`unityAssetsService`), a model's files beside it (`contentService.readBytes`: its `.meta`, a
// glTF's `.bin`) and the model beside a `.meta` (`contentService.read`, `readBeside`), each checked, where it says
// whose it is (`beside`), against what its folder's listing has at that file's own path. A file beside the model is
// found in its folder's children (`cm ls` without `-R`), or in a listing with everything below it the look asked
// first; a file the tree hasn't costs no command.

import { placeId, type Place } from '@shared/domain/place';
import { BRANCH_TREE_LIFE_MS } from '@shared/domain/unityAssets';
import { cmPlace } from '../cm/cmPlace';
import type { CmClient } from '../cm/CmClient';
import { isNotInTreeError } from '../cm/missingItem';
import { OwnCopies, ownCopy } from '../cm/ownCopy';
import { parseTreeListing, treeListingArgs, type ListedItem } from '../cm/treeListing';
import type { RevisionFile } from '../files/WorkspaceCopies';
import type { ProjectAssetIndex } from './ProjectAssetIndex';
import { RepositoryAssetTree } from './RepositoryAssetTree';
import type { RevisionDownloads } from './RevisionDownloads';

/** A point's tree, when it was listed first, and the project indexes read over it (by project, model folder and side). */
export interface KeptTree {
  tree: RepositoryAssetTree;
  since: number;
  indexes: Map<string, ProjectAssetIndex>;
}

/** The points whose trees are kept, the latest used: both sides of a few diffs. */
const KEPT_TREES = 8;

interface RepositoryTreesOptions {
  cm: Pick<CmClient, 'query' | 'execute'>;
  downloads: Pick<RevisionDownloads, 'read'>;
  platform?: NodeJS.Platform;
  /** The time, which a branch head's tree is kept for. */
  now?: () => number;
}

export class RepositoryTrees {
  /** By place and point, the latest used last. */
  private readonly trees = new Map<string, KeptTree>();
  /** The repository specs the listings name, one copy each (`ownItems`). */
  private readonly repositories = new OwnCopies();
  private readonly cm: Pick<CmClient, 'query' | 'execute'>;
  private readonly downloads: Pick<RevisionDownloads, 'read'>;
  private readonly platform: NodeJS.Platform;
  private readonly now: () => number;

  constructor({ cm, downloads, platform = process.platform, now = Date.now }: RepositoryTreesOptions) {
    this.cm = cm;
    this.downloads = downloads;
    this.platform = platform;
    this.now = now;
  }

  /**
   * The point's tree, listed once while kept: a branch head's for `BRANCH_TREE_LIFE_MS`. One per point, whichever side
   * asks: both sides of a diff share its listings, each seeing them with its own change undone (`view`'s `before`).
   */
  at(place: Place, at: string): KeptTree {
    const key = JSON.stringify([placeId(place), at]);
    const where = cmPlace(place);
    const kept = this.trees.get(key);
    this.trees.delete(key);
    if (kept && (at.startsWith('cs:') || this.now() - kept.since < BRANCH_TREE_LIFE_MS)) return this.trees.set(key, kept), kept;
    const source = {
      // A folder's children are quick to list, in a pooled `cm shell`; a subtree, however small it looks, may be a
      // whole project, in a process of its own (`execute`), never holding a shell other reads wait for.
      list: (folder: string, recursive: boolean) => {
        const args = treeListingArgs(folder, where.spec(at), recursive);
        const listed = recursive ? this.cm.execute(args, where.options) : this.cm.query(args, where.options);
        return listed.then(
          (output) => this.ownItems(parseTreeListing(output)),
          (error: unknown) => (isNotInTreeError(error) ? null : Promise.reject(error)),
        );
      },
      read: (file: Parameters<RevisionDownloads['read']>[1], mayDownload: () => boolean) => this.downloads.read(place, file, mayDownload),
    };
    const fresh = { tree: new RepositoryAssetTree(source, this.platform), since: this.now(), indexes: new Map<string, ProjectAssetIndex>() };
    this.trees.set(key, fresh);
    for (const oldest of this.trees.keys()) {
      if (this.trees.size <= KEPT_TREES) break;
      this.trees.delete(oldest);
    }
    return fresh;
  }

  /**
   * The items as strings of their own (`ownCopy`): a kept tree keeps its listings, whose items are otherwise slices of
   * the whole output, a whole project's listing kept for a few names.
   */
  private ownItems(items: ListedItem[]): ListedItem[] {
    return items.map(({ path, revision, hash, ...rest }) => ({
      ...rest,
      path: ownCopy(path),
      revision: { revisionId: revision.revisionId, repository: this.repositories.of(revision.repository) },
      hash: ownCopy(hash),
    }));
  }

  /**
   * The revision of a workspace-relative file beside a model at a point whose tree `cm ls` lists (`listsTree`), from
   * its folder's listing (`fileBeside`), with the size and hash that tell the disk's copy; null where the tree hasn't
   * it. Rejects where the tree couldn't be listed. Also what a `beside` check reads: the revision at the path of the
   * file a sibling goes with.
   */
  async fileAt(place: Place, at: string, path: string): Promise<RevisionFile | null> {
    const file = await this.at(place, at).tree.fileBeside(path);
    return file?.stored === 'repository' ? { path: file.path, revision: file.revision, hash: file.hash, size: file.size } : null;
  }
}
