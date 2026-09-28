import type { ContentSource } from '@shared/domain/content';
import { isPinnedSpec } from '@shared/domain/specs';

/**
 * Whether a content source always reads the same text: a revision by id, nothing, a path in a changeset or shelve, or
 * a spec pinned to one.
 */
export function isImmutableContent(source: ContentSource): boolean {
  if (source.kind === 'revision' || source.kind === 'empty' || source.kind === 'repositoryPath') return true;
  return source.kind === 'spec' && isPinnedSpec(source.spec);
}
