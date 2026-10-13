import type { ContentSource } from '@shared/domain/content';
import { isPinnedSpec } from '@shared/domain/specs';

/**
 * Whether a content source always reads the same text: a revision by id, nothing, a path in a changeset or shelve, or
 * a spec pinned to one. A `repositoryPath` at a branch (`br:`) or a label counts too: only a model's sibling the diff of
 * that point left alone is read so (`diffSibling`; merges read changesets and shelves), and a sibling that changes there
 * becomes an entry of that diff once it is read again, read by its revision under another key.
 */
export function isImmutableContent(source: ContentSource): boolean {
  if (source.kind === 'revision' || source.kind === 'empty' || source.kind === 'repositoryPath') return true;
  return source.kind === 'spec' && isPinnedSpec(source.spec);
}
