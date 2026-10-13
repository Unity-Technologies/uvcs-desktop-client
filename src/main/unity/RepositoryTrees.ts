// The repository's trees at the points a model viewer reads (a changeset, a branch's head), each listed once while
// kept and shared by every read there (docs/features/model-diff.md, "Beside the model" and "Materials"): the Materials
// look's lookups (`unityAssetsService`) and a model's files beside it (`contentService.readBytes`: its `.meta`, a
// glTF's `.bin`), so one `cm ls` of the model's folder answers them all, and a file the tree hasn't costs no command.

import type { RevisionRef } from '@shared/domain/revision';
import { BRANCH_TREE_LIFE_MS } from '@shared/domain/unityAssets';
import type { CmClient } from '../cm/CmClient';
import { isNotInTreeError } from '../cm/missingItem';
import { parseTreeListing, treeListingArgs } from '../cm/treeListing';
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
  /** By workspace and point, the latest used last. */
  private readonly trees = new Map<string, KeptTree>();
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
  at(workspacePath: string, at: string): KeptTree {
    const key = JSON.stringify([workspacePath, at]);
    const kept = this.trees.get(key);
    this.trees.delete(key);
    if (kept && (at.startsWith('cs:') || this.now() - kept.since < BRANCH_TREE_LIFE_MS)) return this.trees.set(key, kept), kept;
    const source = {
      // A folder's children are quick to list, in a pooled `cm shell`; a subtree, however small it looks, may be a
      // whole project, in a process of its own (`execute`), never holding a shell other reads wait for.
      list: (folder: string, recursive: boolean) => {
        const args = treeListingArgs(folder, at, recursive);
        const listed = recursive ? this.cm.execute(args, { cwd: workspacePath }) : this.cm.query(args, { cwd: workspacePath });
        return listed.then(parseTreeListing, (error: unknown) => (isNotInTreeError(error) ? null : Promise.reject(error)));
      },
      read: (file: Parameters<RevisionDownloads['read']>[1], mayDownload: () => boolean) => this.downloads.read(workspacePath, file, mayDownload),
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
   * The revision of a workspace-relative file beside a model at a point whose tree `cm ls` lists (`listsTree`), from
   * its folder's listing (`fileBeside`); null where the tree hasn't it. Rejects where the tree couldn't be listed.
   */
  async revisionAt(workspacePath: string, at: string, path: string): Promise<RevisionRef | null> {
    const file = await this.at(workspacePath, at).tree.fileBeside(path);
    return file?.stored === 'repository' ? file.revision : null;
  }
}
