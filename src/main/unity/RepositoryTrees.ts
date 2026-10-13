// The repository's trees at the points a model viewer reads (a changeset, a branch's head), each listed once while
// kept and shared by every read there (docs/features/model-diff.md, "Beside the model" and "Materials"): the Materials
// look's lookups (`unityAssetsService`) and a model's files beside it (`contentService.readBytes`: its `.meta`, a
// glTF's `.bin`), so one `cm ls` of the model's folder answers them all, and a file the tree hasn't costs no command.

import type { AssetsPoint } from '@shared/domain/unityAssets';
import type { CmClient } from '../cm/CmClient';
import { isNotInTreeError } from '../cm/missingItem';
import { parseTreeListing, treeListingArgs } from '../cm/treeListing';
import type { ProjectAssetIndex } from './ProjectAssetIndex';
import { RepositoryAssetTree } from './RepositoryAssetTree';
import type { RevisionDownloads } from './RevisionDownloads';

/** A point's tree, when it was listed first, and the project indexes read over it (by project and model folder). */
export interface KeptTree {
  tree: RepositoryAssetTree;
  since: number;
  indexes: Map<string, ProjectAssetIndex>;
}

/** The points whose trees are kept, the latest used: both sides of a few diffs. */
const KEPT_TREES = 8;
/**
 * How long a branch head's tree is kept: a changeset's never changes, a branch's moves as people check in. Long enough
 * for the reads of the diff on screen, both sides and both rounds of lookups, to share one listing.
 */
export const BRANCH_TREE_LIFE_MS = 60_000;

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

  /** The point's tree, listed once while kept: a branch head's for `BRANCH_TREE_LIFE_MS`. */
  at(workspacePath: string, point: Extract<AssetsPoint, { kind: 'repository' }>): KeptTree {
    const key = JSON.stringify([workspacePath, point]);
    const kept = this.trees.get(key);
    this.trees.delete(key);
    if (kept && (point.at.startsWith('cs:') || this.now() - kept.since < BRANCH_TREE_LIFE_MS)) return this.trees.set(key, kept), kept;
    const source = {
      // The model's folder is quick to list; a whole project may take a while, in a process of its own.
      list: (folder: string, scope: 'near' | 'wide') => {
        const args = treeListingArgs(folder, point.at);
        const listed = scope === 'near' ? this.cm.query(args, { cwd: workspacePath }) : this.cm.execute(args, { cwd: workspacePath });
        return listed.then(parseTreeListing, (error: unknown) => (isNotInTreeError(error) ? null : Promise.reject(error)));
      },
      read: (file: Parameters<RevisionDownloads['read']>[1], mayDownload: () => boolean) => this.downloads.read(workspacePath, file, mayDownload),
    };
    const fresh = { tree: new RepositoryAssetTree(source, point.before, this.platform), since: this.now(), indexes: new Map<string, ProjectAssetIndex>() };
    this.trees.set(key, fresh);
    for (const oldest of this.trees.keys()) {
      if (this.trees.size <= KEPT_TREES) break;
      this.trees.delete(oldest);
    }
    return fresh;
  }

  /**
   * The revision of a workspace-relative file at a point whose tree `cm ls` lists (`listsTree`), from the listing of its
   * folder; null where the tree hasn't it. Rejects where the tree couldn't be listed.
   */
  async revisionAt(workspacePath: string, at: string, path: string) {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const file = await this.at(workspacePath, { kind: 'repository', at }).tree.view(folder, folder, null).file(path);
    return file?.stored === 'repository' ? file.revision : null;
  }
}
