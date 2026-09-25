import type { ContentSource } from '@shared/domain/content';

/** A spec pinned to a changeset or a shelve (`serverpath:/a.ts#cs:12`, `itemid:27#sh:3`) always reads the same revision. */
const PINNED_SPEC = /#(?:cs|sh):\d+$/;

/** Whether a content source always reads the same text: a revision by id, nothing, or a pinned spec. */
export function isImmutableContent(source: ContentSource): boolean {
  if (source.kind === 'revision' || source.kind === 'empty') return true;
  return source.kind === 'spec' && PINNED_SPEC.test(source.spec);
}
