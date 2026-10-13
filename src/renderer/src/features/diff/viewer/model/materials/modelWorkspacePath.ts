import type { ContentSource } from '@shared/domain/content';
import { otherRepository } from '@shared/domain/repository';
import { sourcePathOf } from '../modelSiblings';

/**
 * Where the workspace has the model a side shows, workspace-relative and `/`-separated: the workspace is its
 * repository's root, so a repository path is one without its leading `/`. Null for none, and for a revision of
 * another repository (an xlinked one's changeset, a last change in another repository): its path names a folder of
 * another tree, whose textures aren't these; only what the file itself holds shows then.
 */
export function modelWorkspacePath(source: ContentSource, workspaceRepository: string | undefined): string | null {
  if (source.kind === 'revision' && otherRepository(source.revision.repository, workspaceRepository)) return null;
  return sourcePathOf(source)?.replace(/^\/+/, '').replaceAll('\\', '/') ?? null;
}
