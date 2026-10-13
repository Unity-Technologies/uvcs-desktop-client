import type { ContentSource } from '@shared/domain/content';
import { sourcePathOf } from '../modelSiblings';

/**
 * Where the workspace has the model a side shows, workspace-relative and `/`-separated: the workspace is its
 * repository's root, so a repository path is one without its leading `/`. A revision of an xlinked repository is no
 * exception: Files' last change and a changeset diff name it by its workspace path, the xlink's folder included
 * (`cm ls`'s `WkPath`, `cm diff`'s path), and its files are on disk there, part of the Unity project as Unity sees it.
 * Null only for a source without a path.
 */
export function modelWorkspacePath(source: ContentSource): string | null {
  return sourcePathOf(source)?.replace(/^\/+/, '').replaceAll('\\', '/') ?? null;
}
