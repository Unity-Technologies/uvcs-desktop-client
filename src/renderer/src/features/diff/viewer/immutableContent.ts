import type { ContentSource } from '@shared/domain/content';
import { isPinnedSpec } from '@shared/domain/specs';

/** Whether a content source always reads the same text: a revision by id, nothing, or a spec pinned to a changeset or shelve. */
export function isImmutableContent(source: ContentSource): boolean {
  if (source.kind === 'revision' || source.kind === 'empty') return true;
  return source.kind === 'spec' && isPinnedSpec(source.spec);
}
